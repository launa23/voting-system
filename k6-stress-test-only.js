// k6-stress-test-only.js
// Stress Test - Tìm giới hạn hệ thống (Breaking Point)
// 
// PURPOSE:
//   - Find maximum system capacity
//   - Identify breaking point
//   - Test system behavior under extreme load
//   - Discover bottlenecks and failure modes
//
// USAGE:
//   k6 run k6-stress-test-only.js
//
// DURATION: 15 phút
//
// SYSTEM CONFIG:
//   - DynamoDB WCU: 10,000
//   - Lambda Concurrent: 1,000
//
// EXPECTED RESULTS:
//   - Breaking point: 45,000-50,000 req/s
//   - DynamoDB will throttle first (10k WCU limit)
//   - Lambda may throttle at 1,000 concurrent
//   - Error rate will increase beyond capacity
//   - System should gracefully degrade

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const voteSuccessRate = new Rate('vote_success_rate');
const failedVotes = new Counter('failed_votes');
const throttledRequests = new Counter('throttled_requests');

const API_ENDPOINT = __ENV.API_ENDPOINT || 'https://yyqlgw45k1.execute-api.ap-southeast-1.amazonaws.com';
const CLOUDFRONT_URL = __ENV.CLOUDFRONT_URL || 'https://d1p3k2c6pdc5rg.cloudfront.net/candidates.json';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJraWQiOiJMYVBJWXFhcjNqTlE2WFhnd3gxdmJWbGVCRVhhNzI5cTRpd3NUNXo3S2RvPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI0OWZhYjVmYy0wMGYxLTcwNzYtZjU3Ny1hYjExZjYwZWIzN2EiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfSU5oVG1STHd4IiwiY2xpZW50X2lkIjoiMXIxZmVtOHVqOWRzc3JudGFwaTZocDNxZnMiLCJvcmlnaW5fanRpIjoiNjFkNDJiZjktNjZiOC00NTk1LTg4MDgtMTMzOGEyN2UwZjZmIiwiZXZlbnRfaWQiOiI4M2Q1ZTVmMC0yZmM3LTQ5ZDEtOTFhMi0yNGQ0MDAxOTQ3OWIiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzcwMzQ5ODU3LCJleHAiOjE3NzAzNTM0NTcsImlhdCI6MTc3MDM0OTg1NywianRpIjoiZDcxNDMwZDUtYjQ3Ni00OTNiLWJjYjQtZGE4NDU3ODU3Mzk1IiwidXNlcm5hbWUiOiI0OWZhYjVmYy0wMGYxLTcwNzYtZjU3Ny1hYjExZjYwZWIzN2EifQ.EAt0WzPj5gPGEzJ9eV6TcxW5gY8Ucoe8FSKqGTe-JlWSmd-necx_3SSDf7R7d0pJA_sG7YJfJ0lGwxS-Zthef5-Que8Whd_ds87bj1y9FDaTV9Y4iLmmq1ta73omt7DOGZBeprL65moSfi68uW4WRoXh08iaC3kR2R--fZ6qC8zqqySYhtSdxfTDmsb7xVSpDLUqXS9k2CgNf1hX9EX1LANwGoPjFihGrLjvLmIfSoo9WLKCI1aNaycgZ0cl-2RzD87Zis2B8Hs-eDfHzPfkp7ZiIo4N9MXoNEbZLZKzzOJlsnoJBq2v78cmBFw_7ns4zsF3GU0vNDPht1udt7fvPQ';
const CANDIDATE_IDS = ['cand1', 'cand2', 'cand3', 'cand4'];

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 2000,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 2000,
      stages: [
        { duration: '2m', target: 5000 },    // 5k req/s
        { duration: '2m', target: 10000 },   // 10k req/s (DynamoDB max)
        { duration: '2m', target: 15000 },   // 15k req/s (expect throttling)
        { duration: '2m', target: 20000 },   // 20k req/s (heavy throttling)
        { duration: '2m', target: 30000 },   // 30k req/s (breaking point)
        { duration: '2m', target: 40000 },   // 40k req/s (extreme)
        { duration: '2m', target: 50000 },   // 50k req/s (find limit)
        { duration: '1m', target: 0 },       // Ramp down
      ],
      exec: 'voteScenario',
    },
  },
  
  // Relaxed thresholds - we expect failures at extreme load
  thresholds: {
    'http_req_duration': ['p(95)<2000'],     // Allow high latency
    'http_req_failed': ['rate<0.50'],        // 50% failure acceptable at extremes
    'vote_success_rate': ['rate>0.50'],      // At least 50% success
  },
};

let userCounter = 0;

function generateUserId() {
  return `stress-u${++userCounter}-${Date.now()}`;
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
    
    // Track throttling specifically
    if (res.status === 429 || res.status === 503) {
      throttledRequests.add(1);
      
      // Sample log throttle errors (1%)
      if (Math.random() < 0.01) {
        console.warn(`⚠️ Throttled: ${res.status}`);
      }
    }
  }
}

export function setup() {
  console.log('\n' + '='.repeat(70));
  console.log('🔥 STRESS TEST - Find Breaking Point');
  console.log('='.repeat(70));
  console.log('Duration: 15 minutes');
  console.log('Target: Push to 50,000 req/s (find system limit)');
  console.log('Expected: Throttling at ~10,000 req/s (DynamoDB WCU limit)');
  console.log('='.repeat(70));
  console.log('\n📈 Progressive Load Stages:');
  console.log('  2m - Ramp to 5,000 req/s   (Safe)');
  console.log('  2m - Ramp to 10,000 req/s  (DynamoDB limit) ⚠️');
  console.log('  2m - Ramp to 15,000 req/s  (Expect throttling)');
  console.log('  2m - Ramp to 20,000 req/s  (Heavy throttling)');
  console.log('  2m - Ramp to 30,000 req/s  (Breaking point)');
  console.log('  2m - Ramp to 40,000 req/s  (Extreme)');
  console.log('  2m - Ramp to 50,000 req/s  (Find absolute limit) 🔥');
  console.log('  1m - Ramp down\n');
  
  const res = http.get(`${API_ENDPOINT}/candidates`);
  if (res.status !== 200) {
    throw new Error(`API not accessible: ${res.status}`);
  }
  console.log('✅ API Ready');
  console.log('\n⚠️  IMPORTANT:');
  console.log('   • Errors are EXPECTED at high load');
  console.log('   • We want to find where system breaks');
  console.log('   • Monitor CloudWatch for throttling metrics');
  console.log('   • DynamoDB throttling expected at >10k req/s');
  console.log('   • Lambda throttling possible at >30k req/s\n');
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = ((Date.now() - data.startTime) / 1000 / 60).toFixed(1);
  console.log('\n' + '='.repeat(70));
  console.log(`✅ STRESS TEST COMPLETED - Duration: ${duration} minutes`);
  console.log('='.repeat(70));
  console.log('\n📊 Key Questions to Answer:');
  console.log('   1. At what req/s did errors start?');
  console.log('   2. What was the bottleneck? (DynamoDB, Lambda, SQS)');
  console.log('   3. How did system degrade? (gradual or sudden)');
  console.log('   4. What was max successful throughput?');
  console.log('   5. Did system recover after load decreased?');
  console.log('\n💡 Next Steps:');
  console.log('   • Review CloudWatch metrics');
  console.log('   • Check DynamoDB throttle events');
  console.log('   • Analyze Lambda concurrent execution peaks');
  console.log('   • Review SQS queue depth during test');
  console.log('   • Consider capacity increases if needed\n');
}
