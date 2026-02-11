// k6-load-test.js
// Load Test - Kiểm tra khả năng chịu tải bền vững
// 
// PURPOSE:
//   - Test sustained high throughput
//   - Verify system stability under normal peak load
//   - Measure consistent performance metrics
//   - Validate auto-scaling effectiveness
//
// USAGE:
//   k6 run k6-load-test.js
//
// DURATION: 10 phút
//
// SYSTEM CONFIG:
//   - DynamoDB WCU: 10,000
//   - Lambda Concurrent: 1,000
//
// EXPECTED RESULTS:
//   - Throughput: EXACTLY 10,000 req/s (controlled)
//   - p95 latency: 40-80ms
//   - Error rate: <1%
//   - DynamoDB utilization: 35-40%
//   - Lambda concurrent: 300-350

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const voteSuccessRate = new Rate('vote_success_rate');
const failedVotes = new Counter('failed_votes');

const API_ENDPOINT = __ENV.API_ENDPOINT || 'https://f8rpo1hjn2.execute-api.ap-southeast-1.amazonaws.com';
const CLOUDFRONT_URL = __ENV.CLOUDFRONT_URL || 'https://d3vvv7egqrgahj.cloudfront.net/candidates.json';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJraWQiOiJZSVc1SFh0MkxFYW1aOWZWRUc4NzRYcWZOWFJYV3JrQzlJMEw0M0RndjNvPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJjOWRhZTU1Yy1mMGIxLTcwMTAtNzQ2Yy1iODYyOWU0MmZlMDMiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfVVhNeGQ4ckxIIiwiY2xpZW50X2lkIjoidXRuaWVuaTVnOXE0dWtyM3Y2MDRqNmVmcyIsIm9yaWdpbl9qdGkiOiI3ZDBmNTJkYi0xMGIzLTQ1NmUtYjhjNS01MTEzNjQwNWMyYjgiLCJldmVudF9pZCI6IjUyZjZlYjBhLTc2YWUtNDgxYy1hZmNlLWY1NGE2ODIxMjRkZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3NzA3MDY0NTYsImV4cCI6MTc3MDc5Mjg1NiwiaWF0IjoxNzcwNzA2NDU2LCJqdGkiOiI3ZTg2YWY1NC00ZGZhLTRiYzAtYjJiYi1hMGEwOGMzYzI4OTQiLCJ1c2VybmFtZSI6ImM5ZGFlNTVjLWYwYjEtNzAxMC03NDZjLWI4NjI5ZTQyZmUwMyJ9.JnXnhfuXnIo6c6dsCIS8dqE-Wb25uv_vkk8VB24vXrExqLnMXF6D7GwiHqqMg9MvEpMq3am_SlFvmzjbIm9p75hGOBHPHULWssHrwt574KRKuF7_D0JpPlZbFuuIBVxILZCLHOahtQTpMHzsUk3UOAh1h_vNtzYEGdaUDJjZaIbX-6D95Iuhld-L9iIVYzCT21CLu8ECpF0NGTnkqdck7MNzbjEf9MwzwDH96ZC7_Tkh74RYizq1DoDcC131atjvbzVO0i6o8ciFz0xqZYuFpM3qffj8NSBhB90vHNPPcYgHwx_Cv-4vgSTZknwPSXFheI3mWzEMBtKGNJiUWWJ8oQ';
const CANDIDATE_IDS = ['cand1', 'cand2', 'cand3', 'cand4'];

export const options = {
  scenarios: {
    // Sustained load - CONTROLLED arrival rate
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: 10000,            // EXACTLY 10,000 req/s (votes)
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 250,
      maxVUs: 350,
      gracefulStop: '30s',
      exec: 'voteScenario',
    },
    
    // Test đọc candidates từ CloudFront
    read_cloudfront: {
      executor: 'constant-arrival-rate',
      rate: 3000,            // EXACTLY 3,000 req/s (reads)
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 150,
      maxVUs: 200,
      exec: 'readCandidatesCloudFront',
    },
  },
  
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
    'vote_success_rate': ['rate>0.98'],
  },
};

let userCounter = 0;

function generateUserId() {
  return `load-u${++userCounter}-${Date.now()}`;
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
  console.log('📊 LOAD TEST - Sustained High Throughput');
  console.log('='.repeat(70));
  console.log('Duration: 10 minutes');
  console.log('Target: EXACTLY 10,000 req/s sustained');
  console.log('Breakdown:');
  console.log('  - Votes (API):      7,000 req/s (constant-arrival-rate)');
  console.log('  - Reads (CloudFront): 3,000 req/s (constant-arrival-rate)');
  console.log('  - TOTAL:            10,000 req/s');
  console.log('='.repeat(70) + '\n');
  
  const res = http.get(`${API_ENDPOINT}/candidates`);
  if (res.status !== 200) {
    throw new Error(`API not accessible: ${res.status}`);
  }
  console.log('✅ API Ready');
  console.log('💡 Tip: Monitor CloudWatch for DynamoDB/Lambda metrics\n');
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = ((Date.now() - data.startTime) / 1000 / 60).toFixed(1);
  console.log('\n' + '='.repeat(70));
  console.log(`✅ LOAD TEST COMPLETED - Duration: ${duration} minutes`);
  console.log('='.repeat(70) + '\n');
}
