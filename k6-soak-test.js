// k6-soak-test.js
// Soak Test (Endurance Testing) cho Voting System
// 
// USAGE:
//   Full soak test (2h+):     k6 run k6-soak-test.js
//   Moderate only (30m):      k6 run k6-soak-test.js --scenario soak_moderate
//   Sustained only (1h):      k6 run k6-soak-test.js --scenario soak_sustained
//   CloudFront only (2h):     k6 run k6-soak-test.js --scenario soak_cloudfront
//
// PURPOSE:
//   - Detect memory leaks over extended periods
//   - Identify performance degradation over time
//   - Test resource exhaustion (connections, file handles)
//   - Verify system stability under sustained load
//   - Monitor Lambda cold start patterns
//
// EXPECTED PERFORMANCE (4 vCPU 8GB RAM):
//   - Moderate: 200 VUs, 30 min, ~10.8M requests (~6,000 req/s)
//   - Sustained: 250 VUs, 1 hour, ~24M requests (~8,000 req/s)
//   - CloudFront: 3,000 req/s, 2 hours, ~21.6M requests
//   - p95 latency: <800ms (may degrade slightly over time - normal)
//   - Error rate: <1% (stricter than stress tests)
//   - Success rate: >98%
//
// SYSTEM REQUIREMENTS:
//   - k6 v0.40+
//   - EC2: 4 vCPU, 8GB RAM (c6i.xlarge or better)
//   - Backend: DynamoDB WCU >= 5000-6000 sustained
//   - Lambda: Reserved concurrency >= 1000
//   - CloudWatch: Enable detailed monitoring for trend analysis
//
// MONITORING CHECKLIST:
//   ✓ Lambda memory usage trends (detect leaks)
//   ✓ DynamoDB throttling over time
//   ✓ SQS queue depth stability
//   ✓ EC2/k6 client memory/CPU
//   ✓ Network connection counts
//   ✓ Response time degradation

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics for soak testing
const voteSuccessRate = new Rate('vote_success_rate');
const failedVotes = new Counter('failed_votes');
const degradationTrend = new Trend('degradation_trend'); // Track latency over time

// ============================================================================
// CẤU HÌNH - THAY ĐỔI THEO HỆ THỐNG CỦA BẠN
// ============================================================================
const API_ENDPOINT = __ENV.API_ENDPOINT || 'https://1qfkkq344f.execute-api.ap-southeast-1.amazonaws.com';
const CLOUDFRONT_URL = __ENV.CLOUDFRONT_URL || 'https://d2us8duxzztzs0.cloudfront.net/candidates.json';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJraWQiOiJ5Mnd4bnVMQU00cE9uTjY0SDJRaHdCRVoyZG4wUFVCWlZDWllaZ09rUjhBPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJkOWZhNDUyYy0zMGIxLTcwZTktODIyOS0xOTc4MGE0MTY4YjYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfcGJqdnpqN0FNIiwiY2xpZW50X2lkIjoiM2w5MmE4Mm8xcHFmc2RkNHRwOTVlNnAycTUiLCJvcmlnaW5fanRpIjoiZjNmYTljMDEtODE4Yi00MWRkLTg3NDMtYWFjNTA4YTUyYmRjIiwiZXZlbnRfaWQiOiIwYzg2ZjRkMS04MDFiLTQxZWEtYTdjMS1hMDVmYjRlMTEzOTAiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzcwMzQxOTE2LCJleHAiOjE3NzA0MjgzMTYsImlhdCI6MTc3MDM0MTkxNiwianRpIjoiY2E0OTMzYjItYWFhZC00MDA2LTk4YjAtMThhNDQ3YjU5MmQyIiwidXNlcm5hbWUiOiJkOWZhNDUyYy0zMGIxLTcwZTktODIyOS0xOTc4MGE0MTY4YjYifQ.ajJjzNKQhaw8dmZuVOSo8diL2MreprZ0VJtDEyrBK_8DVKLOeGfKSsI-FPTsQyNHF3Mai_4U6aPkFIDJdEPuVptv_grLbQArlxedtxTAWqXW9u9ryewNjo60-3zpt8b0jux64y8UWEzNhfWc6StWFu0_SXwmnb-qu4DDqC5r9ut6udJRWhkeQQ2TBhJ5X6MG7ovBYKru9Y97eKwcK3UXBDGFtAJcSQ4ze5RMqAIE0bwtNgp4NKnnAQT6Ee4TkzAa1s12e50tzeKPb9lSjebKGPW5-k5BTydgdINf0LIbNeqHctFY4Bbxnn6IQeCbZEdFs-kONyRmY9058O2J5y4sLQ';
const CANDIDATE_IDS = __ENV.CANDIDATE_IDS ? __ENV.CANDIDATE_IDS.split(',') : ['cand1', 'cand2', 'cand3', 'cand4'];

// ============================================================================
// SOAK TEST SCENARIOS (ENDURANCE TESTING)
// ============================================================================
export const options = {
  scenarios: {
    // Soak Test 1: Moderate Load - 30 phút
    // Purpose: Quick check for stability issues and memory leaks
    soak_moderate: {
      executor: 'constant-vus',
      vus: 200,
      duration: '30m',
      gracefulStop: '30s',
      exec: 'voteScenario',
      tags: { test_type: 'soak_moderate' },
    },
    
    // Soak Test 2: Sustained High Load - 1 giờ
    // Purpose: Test performance degradation over extended periods
    soak_sustained: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '5m', target: 250 },   // Ramp up gradually
        { duration: '50m', target: 250 },  // Hold sustained load
        { duration: '5m', target: 0 },     // Graceful ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'voteScenario',
      tags: { test_type: 'soak_sustained' },
    },
    
    // Soak Test 3: CloudFront Endurance - 2 giờ
    // Purpose: Test CDN cache stability and invalidation over long periods
    soak_cloudfront: {
      executor: 'constant-arrival-rate',
      rate: 3000,
      timeUnit: '1s',
      duration: '2h',
      preAllocatedVUs: 250,
      maxVUs: 400,
      gracefulStop: '30s',
      exec: 'readCandidatesCloudFront',
      tags: { test_type: 'soak_cloudfront' },
    },
    
    // Soak Test 4: Mixed Workload - 1 giờ (Optional)
    // Purpose: Test realistic production-like mixed read/write patterns
    soak_mixed_reads: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1s',
      duration: '1h',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'readCandidatesAPI',
      tags: { test_type: 'soak_mixed' },
    },
  },
  
  // Soak test thresholds - More relaxed but stricter on errors
  thresholds: {
    'http_req_duration': ['p(95)<800', 'p(99)<1500'],     // Allow higher latency over time
    'http_req_failed': ['rate<0.01'],                      // Very strict error rate (<1%)
    'vote_success_rate': ['rate>0.98'],                    // High success rate required
    'degradation_trend': ['p(95)<1000'],                   // Track performance degradation
    
    // Per-scenario thresholds
    'http_req_duration{test_type:soak_moderate}': ['p(95)<700'],
    'http_req_duration{test_type:soak_sustained}': ['p(95)<800'],
    'http_req_duration{test_type:soak_cloudfront}': ['p(95)<500'],
  },
  
  // Extended summary for long-running tests
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  summaryTimeUnit: 's',
  
  // No response body discard for accuracy
  discardResponseBodies: false,
  noConnectionReuse: false,
  userAgent: 'k6-soak-test',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Pre-compute for performance
let userCounter = 0;
const candidatesLength = 4;

function generateUserId() {
  return `u${++userCounter}${Date.now()}`;
}

function getRandomCandidateId() {
  return CANDIDATE_IDS[(Math.random() * candidatesLength) | 0];
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

// Vote Scenario - Optimized for soak testing
export function voteScenario() {
  const userId = generateUserId();
  const candidateId = getRandomCandidateId();
  
  const startTime = Date.now();
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
  const duration = Date.now() - startTime;
  
  // Track degradation trend
  degradationTrend.add(duration);
  
  const success = res.status === 200;
  voteSuccessRate.add(success);
  
  if (!success && res.status !== 403) {
    failedVotes.add(1);
    
    // Log errors periodically (1% sample) to avoid spam
    if (Math.random() < 0.01) {
      console.error(`❌ Vote failed: status=${res.status}, latency=${duration}ms`);
    }
  }
  
  // Small think time to simulate real users (optional - remove for max throughput)
  // sleep(0.1);
}

// Read Candidates via API Gateway
export function readCandidatesAPI() {
  const startTime = Date.now();
  const res = http.get(`${API_ENDPOINT}/candidates`);
  const duration = Date.now() - startTime;
  
  degradationTrend.add(duration);
  
  check(res, {
    '[API] status is 200': (r) => r.status === 200,
    '[API] response time < 800ms': (r) => r.timings.duration < 800,
  });
}

// Read Candidates via CloudFront - For cache endurance testing
export function readCandidatesCloudFront() {
  const startTime = Date.now();
  const res = http.get(CLOUDFRONT_URL);
  const duration = Date.now() - startTime;
  
  degradationTrend.add(duration);
  
  check(res, {
    '[CloudFront] status is 200': (r) => r.status === 200,
    '[CloudFront] response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  // Log cache status periodically (0.1% sample)
  if (Math.random() < 0.001) {
    const cacheStatus = res.headers['X-Cache'] || res.headers['x-cache'] || 'N/A';
    const age = res.headers['Age'] || res.headers['age'] || '0';
    console.log(`CloudFront Cache: ${cacheStatus}, Age: ${age}s, Latency: ${duration}ms`);
  }
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

export function setup() {
  console.log('\n' + '='.repeat(80));
  console.log('⏱️  SOAK TEST (ENDURANCE TESTING) - LONG DURATION');
  console.log('='.repeat(80));
  console.log('📊 Test Duration: 30 minutes to 2 hours');
  console.log('🎯 Purpose: Detect memory leaks, degradation, resource exhaustion');
  console.log('='.repeat(80));
  
  // API health check
  const res = http.get(`${API_ENDPOINT}/candidates`);
  if (res.status !== 200) {
    throw new Error(`API not accessible: ${res.status}`);
  }
  console.log('✅ API Ready');
  
  // CloudFront health check
  if (CLOUDFRONT_URL) {
    const cfRes = http.get(CLOUDFRONT_URL);
    if (cfRes.status === 200) {
      console.log('✅ CloudFront Ready');
    } else {
      console.warn(`⚠️  CloudFront check warning: ${cfRes.status}`);
    }
  }
  
  console.log('\n💡 MONITORING TIPS:');
  console.log('   ✓ Watch CloudWatch for memory/CPU trends');
  console.log('   ✓ Monitor DynamoDB throttling over time');
  console.log('   ✓ Track Lambda cold starts degradation');
  console.log('   ✓ Check SQS queue depth stability');
  console.log('   ✓ Verify no connection leaks');
  console.log('\n⚠️  ABOR CRITERIA:');
  console.log('   • Error rate > 5%: Stop immediately');
  console.log('   • p95 latency > 2s: Investigate backend');
  console.log('   • Memory growth: Potential leak detected');
  console.log('\n🚀 Starting test...\n');
  
  return { 
    startTime: Date.now(),
    startDate: new Date().toISOString(),
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  
  const timeStr = hours > 0 
    ? `${hours}h ${minutes}m ${seconds}s`
    : minutes > 0 
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`;
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ SOAK TEST COMPLETED');
  console.log('='.repeat(80));
  console.log(`Started:  ${data.startDate}`);
  console.log(`Ended:    ${new Date().toISOString()}`);
  console.log(`Duration: ${timeStr}`);
  console.log('='.repeat(80));
  console.log('\n📊 NEXT STEPS:');
  console.log('   1. Review CloudWatch metrics for trends');
  console.log('   2. Check Lambda logs for errors/warnings');
  console.log('   3. Analyze DynamoDB capacity usage');
  console.log('   4. Compare latency at start vs end');
  console.log('   5. Verify no resource leaks occurred\n');
}
