// k6-load-test.js
// Vote Load Test - Progressive throughput testing
// 
// PURPOSE:
//   - Test system at 1K, 3K, 10K RPS
//   - Identify throughput limits and bottlenecks
//   - Measure latency at different load levels
//   - Validate DynamoDB PAY_PER_REQUEST scaling
//
// USAGE:
//   k6 run k6-load-test.js
//
// DURATION: 5 phút per scenario = 15 phút total
//
// SYSTEM CONFIG:
//   - DynamoDB: PAY_PER_REQUEST (auto-scale)
//   - Lambda Concurrent: 1,000
//
// EXPECTED RESULTS:
//   - 1K RPS:  p95 < 100ms, Error < 0.1%
//   - 3K RPS:  p95 < 200ms, Error < 0.5%
//   - 10K RPS: p95 < 500ms, Error < 1%

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const voteSuccessRate = new Rate('vote_success_rate');
const failedVotes = new Counter('failed_votes');

const API_ENDPOINT = __ENV.API_ENDPOINT || 'https://gsc0p9az45.execute-api.ap-southeast-1.amazonaws.com';
const CLOUDFRONT_URL = __ENV.CLOUDFRONT_URL || 'https://d1k9m728ox4w8w.cloudfront.net/candidates.json';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJraWQiOiI5MGNnNjk4ZTZWeXhIbGl5MnNvMzFLYXhhUW03OUM4ZWt5cWdqWktlNk40PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJiOWFhYTVhYy04MDgxLTcwNTUtMGNiMS02ZTQ4NTc1YTM1ZjMiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfVzR3eVdIaURHIiwiY2xpZW50X2lkIjoiMm5hcmtlcWV2cWQwbXRrOTZzbHRrdTcxYTEiLCJvcmlnaW5fanRpIjoiMTYwYmVhNjctYjE4Zi00YWRiLWE1OTUtMjA0OTQ0N2UwZWIzIiwiZXZlbnRfaWQiOiI3MzlmMjY5Yy04NzMxLTRhMGItYTNkNC04M2IyOTc5OWZjYzQiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzcwODY3MDM5LCJleHAiOjE3NzA5NTM0MzksImlhdCI6MTc3MDg2NzAzOSwianRpIjoiNWU3YmU5ZTEtYzY3My00NDI5LTkzNmEtYTQwMDFkMTgzNWZiIiwidXNlcm5hbWUiOiJiOWFhYTVhYy04MDgxLTcwNTUtMGNiMS02ZTQ4NTc1YTM1ZjMifQ.nSmNhLxdpMJkdkiQmNitgoKEksX0ZVKxPcxkLrUsE74RDI1JYiXBBnSk8abTc-axNH6Eg0ywCnZZG6DtEMUWaQuFxdaeHSLOJ3quQTwyKIohPKHBKxhokrQNmRLcwIklPW8p7bbzxUYwOPwT_fbk9LWN7AEM2JrE_Fs9xvcWAVmKXJdJxg8zjLpq_OIvN53737WdL9AgU_W0QOQeqyXIFilNCPN1uy3RZi3yi5F7qwZ1_fhq8neCGyidQkcxn2oETFi_Eb5jqcmm_DX7-gTTAIAX9u79UskygNenW8oEthRpKO7Upd7G0-6aiufnjvuELxLKjQ-RVKetEcBj3B-LFQ';
const CANDIDATE_IDS = ['cand1', 'cand2', 'cand3', 'cand4'];

export const options = {
  scenarios: {
    // Test 1: Low load - 1,000 RPS
    vote_1k_rps: {
      executor: 'constant-arrival-rate',
      rate: 1000,            // 1,000 votes/s
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      gracefulStop: '30s',
      exec: 'voteScenario',
      startTime: '0s',
    },
    
    // Test 2: Medium load - 3,000 RPS
    vote_3k_rps: {
      executor: 'constant-arrival-rate',
      rate: 3000,            // 3,000 votes/s
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      gracefulStop: '30s',
      exec: 'voteScenario',
      startTime: '5m',       // Start after first test
    },
    
    // Test 3: High load - 10,000 RPS
    vote_10k_rps: {
      executor: 'constant-arrival-rate',
      rate: 10000,           // 10,000 votes/s
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 250,
      maxVUs: 400,
      gracefulStop: '30s',
      exec: 'voteScenario',
      startTime: '10m',      // Start after second test
    },
    
    // COMMENT OUT: Read test from CloudFront
    // read_cloudfront: {
    //   executor: 'constant-arrival-rate',
    //   rate: 3000,
    //   timeUnit: '1s',
    //   duration: '10m',
    //   preAllocatedVUs: 150,
    //   maxVUs: 200,
    //   exec: 'readCandidatesCloudFront',
    // },
  },
  
  thresholds: {
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
    'http_req_failed': ['rate<0.02'],    // Allow 2% error for high load
    'vote_success_rate': ['rate>0.95'],  // 95% success minimum
  },
};

// Generate unique user ID using VU ID + iteration + timestamp + random
// This ensures NO duplicates across all VUs and iterations
function generateUserId() {
  const vu = __VU;              // Virtual User ID (1-350)
  const iter = __ITER;          // Iteration number (0-N)
  const rand = Math.random().toString(36).substring(2, 8); // Random 6 chars
  return `load-vu${vu}-i${iter}-${rand}`;
}

function getRandomCandidateId() {
  return CANDIDATE_IDS[Math.floor(Math.random() * CANDIDATE_IDS.length)];
}

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
  
  const success = res.status === 200;
  voteSuccessRate.add(success);
  
  if (!success && res.status !== 403) {
    failedVotes.add(1);
  }
}

export function readCandidatesCloudFront() {
  const res = http.get(CLOUDFRONT_URL);
  
  check(res, {
    '[CloudFront] status is 200': (r) => r.status === 200,
    '[CloudFront] response time < 500ms': (r) => r.timings.duration < 500,
  });
}

export function setup() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PROGRESSIVE VOTE LOAD TEST');
  console.log('='.repeat(70));
  console.log('Duration: 15 minutes (3 stages × 5 minutes)');
  console.log('');
  console.log('Test Stages:');
  console.log('  Stage 1 (0-5m):   1,000 RPS  - Baseline performance');
  console.log('  Stage 2 (5-10m):  3,000 RPS  - Medium load');
  console.log('  Stage 3 (10-15m): 10,000 RPS - Peak load');
  console.log('');
  console.log('System Configuration:');
  console.log('  - DynamoDB: PAY_PER_REQUEST (auto-scaling)');
  console.log('  - Lambda: Reserved concurrency 1,000');
  console.log('  - Write sharding: 10 shards per candidate');
  console.log('='.repeat(70) + '\n');
  
  const res = http.get(`${API_ENDPOINT}/candidates`);
  if (res.status !== 200) {
    throw new Error(`API not accessible: ${res.status}`);
  }
  console.log('✅ API Ready');
  console.log('💡 Tip: Monitor CloudWatch for DynamoDB throttle metrics\n');
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = ((Date.now() - data.startTime) / 1000 / 60).toFixed(1);
  console.log('\n' + '='.repeat(70));
  console.log(`✅ PROGRESSIVE LOAD TEST COMPLETED - Duration: ${duration} minutes`);
  console.log('='.repeat(70) + '\n');
  console.log('Next Steps:');
  console.log('  1. Check CloudWatch for DynamoDB throttle events');
  console.log('  2. Verify total votes: curl https://d1k9m728ox4w8w.cloudfront.net/candidates.json');
  console.log('  3. Review Lambda VoteWorker logs for errors\n');
}

