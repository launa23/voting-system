// k6-stress-test.js
// Stress test cho Voting System - Optimized for 4 vCPU 8GB RAM
// Chạy: k6 run k6-stress-test.js
//
// EXPECTED PERFORMANCE (4 vCPU 8GB RAM):
//   - Throughput: 10,000-12,000 req/s sustained
//   - Peak: 15,000+ req/s
//   - Total requests: ~4-5 million in 7m40s
//   - Dropped iterations: <1%
//   - p95 latency: 40-60ms
//
// SYSTEM REQUIREMENTS:
//   - k6 v0.40+
//   - EC2: 4 vCPU, 8GB RAM (c6i.xlarge or better)
//   - Backend: DynamoDB WCU >= 5000, Lambda concurrency >= 1000

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics (reduced for performance)
const voteSuccessRate = new Rate('vote_success_rate');
const failedVotes = new Counter('failed_votes');

// ============================================================================
// CẤU HÌNH - THAY ĐỔI THEO HỆ THỐNG CỦA BẠN
// ============================================================================
const API_ENDPOINT = __ENV.API_ENDPOINT || 'https://1qfkkq344f.execute-api.ap-southeast-1.amazonaws.com';
const CLOUDFRONT_URL = __ENV.CLOUDFRONT_URL || 'https://d2us8duxzztzs0.cloudfront.net/candidates.json'; // CloudFront URL cho candidates cache
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJraWQiOiJ5Mnd4bnVMQU00cE9uTjY0SDJRaHdCRVoyZG4wUFVCWlZDWllaZ09rUjhBPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJkOWZhNDUyYy0zMGIxLTcwZTktODIyOS0xOTc4MGE0MTY4YjYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfcGJqdnpqN0FNIiwiY2xpZW50X2lkIjoiM2w5MmE4Mm8xcHFmc2RkNHRwOTVlNnAycTUiLCJvcmlnaW5fanRpIjoiZjNmYTljMDEtODE4Yi00MWRkLTg3NDMtYWFjNTA4YTUyYmRjIiwiZXZlbnRfaWQiOiIwYzg2ZjRkMS04MDFiLTQxZWEtYTdjMS1hMDVmYjRlMTEzOTAiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzcwMzQxOTE2LCJleHAiOjE3NzA0MjgzMTYsImlhdCI6MTc3MDM0MTkxNiwianRpIjoiY2E0OTMzYjItYWFhZC00MDA2LTk4YjAtMThhNDQ3YjU5MmQyIiwidXNlcm5hbWUiOiJkOWZhNDUyYy0zMGIxLTcwZTktODIyOS0xOTc4MGE0MTY4YjYifQ.ajJjzNKQhaw8dmZuVOSo8diL2MreprZ0VJtDEyrBK_8DVKLOeGfKSsI-FPTsQyNHF3Mai_4U6aPkFIDJdEPuVptv_grLbQArlxedtxTAWqXW9u9ryewNjo60-3zpt8b0jux64y8UWEzNhfWc6StWFu0_SXwmnb-qu4DDqC5r9ut6udJRWhkeQQ2TBhJ5X6MG7ovBYKru9Y97eKwcK3UXBDGFtAJcSQ4ze5RMqAIE0bwtNgp4NKnnAQT6Ee4TkzAa1s12e50tzeKPb9lSjebKGPW5-k5BTydgdINf0LIbNeqHctFY4Bbxnn6IQeCbZEdFs-kONyRmY9058O2J5y4sLQ'; // Thay bằng JWT token hợp lệ
const CANDIDATE_IDS = __ENV.CANDIDATE_IDS ? __ENV.CANDIDATE_IDS.split(',') : ['cand1', 'cand2', 'cand3', 'cand4'];

// ============================================================================
// SCENARIOS - CẤU HÌNH LOAD TEST
// ============================================================================
export const options = {
  scenarios: {
    // Scenario 1: Warm up - 4 vCPU can handle more VUs
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 100 },
      ],
      gracefulRampDown: '0s',
      exec: 'voteScenario',
    },
    
    // Scenario 2: Load Test - 2x VUs for 4 vCPU (300 VUs = ~10k req/s)
    load_test: {
      executor: 'constant-vus',
      vus: 300,
      duration: '2m',
      startTime: '20s',
      gracefulStop: '0s',
      exec: 'voteScenario',
    },
    
    // Scenario 3: Spike Test - 2x burst capacity (800 VUs max for 4 vCPU)
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 300,
      stages: [
        { duration: '10s', target: 800 },
        { duration: '1m', target: 800 },
        { duration: '10s', target: 300 },
      ],
      startTime: '2m20s',
      gracefulRampDown: '0s',
      exec: 'voteScenario',
    },
    
    // Scenario 4: Stress Test - Push to 15k req/s (4 vCPU limit)
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 1000,
      timeUnit: '1s',
      preAllocatedVUs: 800,
      maxVUs: 1200,
      stages: [
        { duration: '20s', target: 2000 },
        { duration: '20s', target: 4000 },
        { duration: '20s', target: 6000 },
        { duration: '20s', target: 8000 },
        { duration: '20s', target: 10000 },
        { duration: '20s', target: 12000 },
        { duration: '20s', target: 15000 },  // Find breaking point
      ],
      startTime: '4m30s',
      exec: 'voteScenario',
    },
    
    // Scenario 5A: Read API - 2x throughput test
    read_test_api: {
      executor: 'constant-arrival-rate',
      rate: 2000,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 200,
      maxVUs: 300,
      startTime: '6m50s',
      exec: 'readCandidatesAPI',
    },
    
    // Scenario 5B: Read CloudFront - Max throughput (4k req/s)
    read_test_cloudfront: {
      executor: 'constant-arrival-rate',
      rate: 4000,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 300,
      maxVUs: 400,
      startTime: '7m10s',
      exec: 'readCandidatesCloudFront',
    },
  },
  
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.05'],
    'vote_success_rate': ['rate>0.95'],
  },
  
  // Disable unnecessary features for max performance
  discardResponseBodies: false, // Keep false to parse response
  noConnectionReuse: false,
  userAgent: 'k6-stress-test',
  
  // Batch requests (optional - uncomment for even higher throughput)
  // batch: 10,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Pre-compute for performance
let userCounter = 0;
const candidatesLength = 4; // CANDIDATE_IDS.length

// Optimized: Simple counter instead of UUID generation
function generateUserId() {
  return `u${++userCounter}${Date.now()}`;
}

// Optimized: Direct array access
function getRandomCandidateId() {
  return CANDIDATE_IDS[(Math.random() * candidatesLength) | 0];
}

// ============================================================================
// SCENARIOS
// ============================================================================

// Vote Scenario - Optimized for max throughput
export function voteScenario() {
  const userId = generateUserId();
  const candidateId = getRandomCandidateId();
  
  const res = http.post(
    `${API_ENDPOINT}/vote`,
    `{"userId":"${userId}","candidateId":"${candidateId}"}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    }
  );
  
  // Minimal checks for performance
  const success = res.status === 200;
  voteSuccessRate.add(success);
  
  if (!success && res.status !== 403) {
    failedVotes.add(1);
  }
}

// Read Candidates via API Gateway - Optimized
export function readCandidatesAPI() {
  const res = http.get(`${API_ENDPOINT}/candidates`);
  
  check(res, {
    '[API] status is 200': (r) => r.status === 200,
    '[API] response time < 500ms': (r) => r.timings.duration < 500,
  });
}

// Read Candidates via CloudFront - Optimized
export function readCandidatesCloudFront() {
  const res = http.get(CLOUDFRONT_URL);
  
  check(res, {
    '[CloudFront] status is 200': (r) => r.status === 200,
    '[CloudFront] response time < 500ms': (r) => r.timings.duration < 500, // Realistic for EC2 → CloudFront
  });
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

export function setup() {
  console.log('\n🚀 Starting stress test...');
  
  // Quick API health check
  const res = http.get(`${API_ENDPOINT}/candidates`);
  if (res.status !== 200) {
    throw new Error(`API not accessible: ${res.status}`);
  }
  
  console.log('✅ Ready\n');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = ((Date.now() - data.startTime) / 1000).toFixed(1);
  console.log(`\n✅ Test completed in ${duration}s\n`);
}
