// k6-spike-test.js
// Spike Test - Kiểm tra khả năng chịu tải đột biến
// 
// PURPOSE:
//   - Test sudden traffic spikes (viral events, flash sales)
//   - Verify auto-scaling responsiveness
//   - Measure recovery time after spike
//   - Identify bottlenecks during rapid scale-up
//
// USAGE:
//   k6 run k6-spike-test.js
//
// DURATION: 8 phút
//
// SYSTEM CONFIG:
//   - DynamoDB WCU: 10,000
//   - Lambda Concurrent: 1,000
//
// EXPECTED RESULTS:
//   - Peak throughput: 35,000-40,000 req/s
//   - Spike duration: 2 minutes at peak
//   - Recovery time: <30s back to normal
//   - Error rate during spike: <5%
//   - Error rate after spike: <1%

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const voteSuccessRate = new Rate('vote_success_rate');
const failedVotes = new Counter('failed_votes');

const API_ENDPOINT = __ENV.API_ENDPOINT || 'https://1qfkkq344f.execute-api.ap-southeast-1.amazonaws.com';
const CLOUDFRONT_URL = __ENV.CLOUDFRONT_URL || 'https://d2us8duxzztzs0.cloudfront.net/candidates.json';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJraWQiOiJ5Mnd4bnVMQU00cE9uTjY0SDJRaHdCRVoyZG4wUFVCWlZDWllaZ09rUjhBPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJkOWZhNDUyYy0zMGIxLTcwZTktODIyOS0xOTc4MGE0MTY4YjYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfcGJqdnpqN0FNIiwiY2xpZW50X2lkIjoiM2w5MmE4Mm8xcHFmc2RkNHRwOTVlNnAycTUiLCJvcmlnaW5fanRpIjoiZjNmYTljMDEtODE4Yi00MWRkLTg3NDMtYWFjNTA4YTUyYmRjIiwiZXZlbnRfaWQiOiIwYzg2ZjRkMS04MDFiLTQxZWEtYTdjMS1hMDVmYjRlMTEzOTAiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzcwMzQxOTE2LCJleHAiOjE3NzA0MjgzMTYsImlhdCI6MTc3MDM0MTkxNiwianRpIjoiY2E0OTMzYjItYWFhZC00MDA2LTk4YjAtMThhNDQ3YjU5MmQyIiwidXNlcm5hbWUiOiJkOWZhNDUyYy0zMGIxLTcwZTktODIyOS0xOTc4MGE0MTY4YjYifQ.ajJjzNKQhaw8dmZuVOSo8diL2MreprZ0VJtDEyrBK_8DVKLOeGfKSsI-FPTsQyNHF3Mai_4U6aPkFIDJdEPuVptv_grLbQArlxedtxTAWqXW9u9ryewNjo60-3zpt8b0jux64y8UWEzNhfWc6StWFu0_SXwmnb-qu4DDqC5r9ut6udJRWhkeQQ2TBhJ5X6MG7ovBYKru9Y97eKwcK3UXBDGFtAJcSQ4ze5RMqAIE0bwtNgp4NKnnAQT6Ee4TkzAa1s12e50tzeKPb9lSjebKGPW5-k5BTydgdINf0LIbNeqHctFY4Bbxnn6IQeCbZEdFs-kONyRmY9058O2J5y4sLQ';
const CANDIDATE_IDS = ['cand1', 'cand2', 'cand3', 'cand4'];

export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 200,
      stages: [
        { duration: '1m', target: 200 },    // Normal load
        { duration: '30s', target: 1200 },  // SPIKE! 6x increase
        { duration: '2m', target: 1200 },   // Hold spike
        { duration: '30s', target: 200 },   // Drop back
        { duration: '2m', target: 200 },    // Recovery observation
        { duration: '30s', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'voteScenario',
    },
    
    // CloudFront spike - simultaneous
    spike_cloudfront: {
      executor: 'ramping-arrival-rate',
      startRate: 1000,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 1000,
      stages: [
        { duration: '1m', target: 1000 },
        { duration: '30s', target: 10000 },  // SPIKE to 10k req/s
        { duration: '2m', target: 10000 },
        { duration: '30s', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '30s', target: 0 },
      ],
      exec: 'readCandidatesCloudFront',
    },
  },
  
  thresholds: {
    'http_req_duration': ['p(95)<800', 'p(99)<1500'],  // Allow higher during spike
    'http_req_failed': ['rate<0.05'],                   // 5% tolerable during spike
    'vote_success_rate': ['rate>0.95'],
  },
};

let userCounter = 0;

function generateUserId() {
  return `spike-u${++userCounter}-${Date.now()}`;
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
    '[CloudFront] response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

export function setup() {
  console.log('\n' + '='.repeat(70));
  console.log('⚡ SPIKE TEST - Sudden Traffic Surge');
  console.log('='.repeat(70));
  console.log('Duration: 8 minutes');
  console.log('Pattern: Normal → 6x SPIKE → Normal');
  console.log('Peak: 35,000-40,000 req/s');
  console.log('='.repeat(70));
  console.log('\n📈 Test Pattern:');
  console.log('  1m   - Normal load (200 VUs)');
  console.log('  30s  - SPIKE UP to 1,200 VUs  ⚡');
  console.log('  2m   - Hold spike load');
  console.log('  30s  - Drop back to normal');
  console.log('  2m   - Observe recovery');
  console.log('  30s  - Ramp down\n');
  
  const res = http.get(`${API_ENDPOINT}/candidates`);
  if (res.status !== 200) {
    throw new Error(`API not accessible: ${res.status}`);
  }
  console.log('✅ API Ready');
  console.log('💡 Tip: Watch for throttling during spike\n');
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = ((Date.now() - data.startTime) / 1000 / 60).toFixed(1);
  console.log('\n' + '='.repeat(70));
  console.log(`✅ SPIKE TEST COMPLETED - Duration: ${duration} minutes`);
  console.log('='.repeat(70));
  console.log('\n📊 Analysis Tips:');
  console.log('   • Check error rate during spike vs normal');
  console.log('   • Verify auto-scaling triggered');
  console.log('   • Compare recovery time to baseline');
  console.log('   • Review CloudWatch for Lambda cold starts\n');
}
