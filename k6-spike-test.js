// k6-spike-test.js
// Spike Test - Kiểm tra khả năng chịu tải đột biến (Vote Only)
// 
// PURPOSE:
//   - Test sudden vote traffic spikes (viral events)
//   - Verify auto-scaling responsiveness
//   - Measure recovery time after spike
//   - Identify bottlenecks during rapid scale-up
//   - Output detailed metrics per stage
//
// USAGE:
//   k6 run k6-spike-test.js
//
// DURATION: 6.5 phút
//
// HARDWARE REQUIREMENTS:
//   - k6 Instance: 4 vCPU, 8GB RAM
//   - Max VUs: ~300-500 (auto-scaled by k6)
//   - RPS Control: arrival-rate executor
//
// STAGES:
//   1. Normal Load (1m): 500 RPS
//   2. Spike Up (30s): 500 → 5000 RPS (10x tăng)
//   3. Hold Spike (2m): 5000 RPS duy trì
//   4. Drop Back (30s): 5000 → 500 RPS
//   5. Recovery (2m): 500 RPS quan sát
//   6. Ramp Down (30s): 500 → 0 RPS
//
// SYSTEM CONFIG:
//   - DynamoDB: PAY_PER_REQUEST
//   - Lambda Concurrent: 1,000
//   - Write Sharding: 10 shards
//
// EXPECTED RESULTS:
//   - Stage 1 (Normal): ~30K votes, <1% error
//   - Stage 2 (Spike Up): ~41K votes, <3% error
//   - Stage 3 (Hold Spike): ~600K votes, <5% error
//   - Stage 4 (Drop Back): ~41K votes, <2% error
//   - Stage 5 (Recovery): ~60K votes, <1% error
//   - Total: ~776K votes
//   - Peak Load: 5,000 RPS = 20,000 WCU/s (50% DynamoDB capacity)

import http from 'k6/http';
import { Rate, Counter, Trend } from 'k6/metrics';

const voteSuccessRate = new Rate('vote_success_rate');
const failedVotes = new Counter('failed_votes');
const totalVotes = new Counter('total_votes');
const voteDuration = new Trend('vote_duration');

const API_ENDPOINT = __ENV.API_ENDPOINT || 'https://gsc0p9az45.execute-api.ap-southeast-1.amazonaws.com';
const CLOUDFRONT_URL = __ENV.CLOUDFRONT_URL || 'https://d1k9m728ox4w8w.cloudfront.net/candidates.json';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJraWQiOiI5MGNnNjk4ZTZWeXhIbGl5MnNvMzFLYXhhUW03OUM4ZWt5cWdqWktlNk40PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJiOWFhYTVhYy04MDgxLTcwNTUtMGNiMS02ZTQ4NTc1YTM1ZjMiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuYXAtc291dGhlYXN0LTEuYW1hem9uYXdzLmNvbVwvYXAtc291dGhlYXN0LTFfVzR3eVdIaURHIiwiY2xpZW50X2lkIjoiMm5hcmtlcWV2cWQwbXRrOTZzbHRrdTcxYTEiLCJvcmlnaW5fanRpIjoiMTYwYmVhNjctYjE4Zi00YWRiLWE1OTUtMjA0OTQ0N2UwZWIzIiwiZXZlbnRfaWQiOiI3MzlmMjY5Yy04NzMxLTRhMGItYTNkNC04M2IyOTc5OWZjYzQiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzcwODY3MDM5LCJleHAiOjE3NzA5NTM0MzksImlhdCI6MTc3MDg2NzAzOSwianRpIjoiNWU3YmU5ZTEtYzY3My00NDI5LTkzNmEtYTQwMDFkMTgzNWZiIiwidXNlcm5hbWUiOiJiOWFhYTVhYy04MDgxLTcwNTUtMGNiMS02ZTQ4NTc1YTM1ZjMifQ.nSmNhLxdpMJkdkiQmNitgoKEksX0ZVKxPcxkLrUsE74RDI1JYiXBBnSk8abTc-axNH6Eg0ywCnZZG6DtEMUWaQuFxdaeHSLOJ3quQTwyKIohPKHBKxhokrQNmRLcwIklPW8p7bbzxUYwOPwT_fbk9LWN7AEM2JrE_Fs9xvcWAVmKXJdJxg8zjLpq_OIvN53737WdL9AgU_W0QOQeqyXIFilNCPN1uy3RZi3yi5F7qwZ1_fhq8neCGyidQkcxn2oETFi_Eb5jqcmm_DX7-gTTAIAX9u79UskygNenW8oEthRpKO7Upd7G0-6aiufnjvuELxLKjQ-RVKetEcBj3B-LFQ';
const CANDIDATE_IDS = ['cand1', 'cand2', 'cand3', 'cand4'];

export const options = {
  scenarios: {
    spike_vote: {
      executor: 'ramping-arrival-rate',
      startRate: 500,
      timeUnit: '1s',
      preAllocatedVUs: 150,
      maxVUs: 500,
      stages: [
        { duration: '1m', target: 500 },    // Stage 1: Normal load - 500 RPS
        { duration: '30s', target: 5000 },  // Stage 2: SPIKE! 10x increase - 5000 RPS
        { duration: '2m', target: 5000 },   // Stage 3: Hold spike - 5000 RPS
        { duration: '30s', target: 500 },   // Stage 4: Drop back - 500 RPS
        { duration: '2m', target: 500 },    // Stage 5: Recovery - 500 RPS
        { duration: '30s', target: 0 },     // Stage 6: Ramp down
      ],
      exec: 'voteScenario',
    },
  },
  
  thresholds: {
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
    'http_req_failed': ['rate<0.05'],
    'vote_success_rate': ['rate>0.95'],
  },
  
  summaryTrendStats: ['min', 'avg', 'med', 'p(95)', 'p(99)', 'max'],
};

// Stage timing (seconds from start)
const STAGE_TIMINGS = [
  { name: 'Stage 1: Normal Load', start: 0, end: 60 },
  { name: 'Stage 2: Spike Up', start: 60, end: 90 },
  { name: 'Stage 3: Hold Spike', start: 90, end: 210 },
  { name: 'Stage 4: Drop Back', start: 210, end: 240 },
  { name: 'Stage 5: Recovery', start: 240, end: 360 },
  { name: 'Stage 6: Ramp Down', start: 360, end: 390 },
];

function getCurrentStage(elapsedSeconds) {
  for (let i = 0; i < STAGE_TIMINGS.length; i++) {
    const stage = STAGE_TIMINGS[i];
    if (elapsedSeconds >= stage.start && elapsedSeconds < stage.end) {
      return stage.name;
    }
  }
  return 'Unknown';
}

function generateUserId() {
  const vu = __VU;
  const iter = __ITER;
  const rand = Math.random().toString(36).substring(2, 8);
  return `spike-vu${vu}-i${iter}-${rand}`;
}

function getRandomCandidateId() {
  return CANDIDATE_IDS[Math.floor(Math.random() * CANDIDATE_IDS.length)];
}

export function voteScenario() {
  const userId = generateUserId();
  const candidateId = getRandomCandidateId();
  
  // Determine current stage for tagging
  const elapsedSeconds = (__ENV.START_TIME) 
    ? (Date.now() - parseInt(__ENV.START_TIME)) / 1000 
    : 0;
  const currentStage = getCurrentStage(elapsedSeconds);
  
  const res = http.post(
    `${API_ENDPOINT}/vote`,
    `{"userId":"${userId}","candidateId":"${candidateId}"}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      tags: {
        stage: currentStage,
      },
    }
  );
  
  totalVotes.add(1);
  voteDuration.add(res.timings.duration, { stage: currentStage });
  
  const success = res.status === 200;
  voteSuccessRate.add(success, { stage: currentStage });
  
  if (!success && res.status !== 403) {
    failedVotes.add(1, { stage: currentStage });
  }
}

export function setup() {
  console.log('\n' + '='.repeat(80));
  console.log('⚡ SPIKE TEST - Vote Traffic Surge (RPS-Based)');
  console.log('='.repeat(80));
  console.log('Duration: 6.5 phút');
  console.log('Hardware: 4 vCPU, 8GB RAM');
  console.log('Pattern: Normal (500 RPS) → SPIKE (5,000 RPS) → Normal (500 RPS)');
  console.log('='.repeat(80));
  console.log('\n📈 Test Stages:');
  console.log('  Stage 1 (1m00s)  - Normal Load:   500 RPS  →  ~30K votes');
  console.log('  Stage 2 (0m30s)  - Spike Up:      500→5K   →  ~41K votes  ⚡⚡');
  console.log('  Stage 3 (2m00s)  - Hold Spike:    5000 RPS →  ~600K votes 🔥🔥');
  console.log('  Stage 4 (0m30s)  - Drop Back:     5K→500   →  ~41K votes');
  console.log('  Stage 5 (2m00s)  - Recovery:      500 RPS  →  ~60K votes');
  console.log('  Stage 6 (0m30s)  - Ramp Down:     500→0    →  cleanup');
  console.log('\n💡 Expected Total: ~776K votes | Peak: 5K RPS = 20K WCU/s\n');
  console.log('📊 System Load: 50% DynamoDB capacity | ~50-100 Lambda concurrent\n');
  
  const res = http.get(`${API_ENDPOINT}/candidates`);
  if (res.status !== 200) {
    throw new Error(`API không khả dụng: ${res.status}`);
  }
  console.log('✅ API Ready - Bắt đầu Spike Test...\n');
  
  // Set start time as environment variable for stage tracking
  const startTime = Date.now();
  __ENV.START_TIME = startTime.toString();
  
  return { startTime };
}

export function handleSummary(data) {
  // Calculate duration from setup data
  const startTime = data.state?.startTime || Date.now() - 390000; // fallback to 6.5 minutes ago
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  
  const metrics = data.metrics;
  
  // Build summary report
  const totalRequests = metrics.http_reqs?.values.count || 0;
  const actualRPS = (totalRequests / 390).toFixed(0);
  const successRate = (metrics.vote_success_rate?.values.rate || 0) * 100;
  const p95 = metrics.http_req_duration?.values['p(95)'] || 0;
  const p99 = metrics.http_req_duration?.values['p(99)'] || 0;
  const failedCount = metrics.failed_votes?.values.count || 0;
  
  let report = '\n' + '='.repeat(70) + '\n';
  report += '⚡ SPIKE TEST KẾT QUẢ\n';
  report += '='.repeat(70) + '\n\n';
  
  report += `⏱️  Thời gian:        ${duration} phút\n`;
  report += `📊 Tổng votes:       ${totalRequests.toLocaleString()} votes\n`;
  report += `🚀 RPS trung bình:   ${actualRPS} RPS (expected: ~1,990 RPS)\n`;
  report += `✅ Success rate:     ${successRate.toFixed(2)}% ${successRate >= 95 ? '✅ PASS' : '❌ FAIL'}\n`;
  report += `❌ Failed votes:     ${failedCount.toLocaleString()}\n\n`;
  
  report += `📈 LATENCY:\n`;
  report += `   - Average:        ${(metrics.http_req_duration?.values.avg || 0).toFixed(2)}ms\n`;
  report += `   - P95:            ${p95.toFixed(2)}ms ${p95 < 1000 ? '✅ PASS' : '⚠️ SLOW'}\n`;
  report += `   - P99:            ${p99.toFixed(2)}ms ${p99 < 2000 ? '✅ PASS' : '⚠️ SLOW'}\n\n`;
  
  report += `🎯 ĐÁNH GIÁ:\n`;
  const targetVotes = 776250;
  const variance = ((totalRequests - targetVotes) / targetVotes * 100).toFixed(1);
  const status = (successRate >= 95 && p95 < 1000) ? '✅ HỆ THỐNG ỔN ĐỊNH' : '⚠️ CẦN KIỂM TRA';
  
  report += `   - Độ lệch:        ${variance}% so với expected (~776K votes)\n`;
  report += `   - Peak load:      5,000 RPS = 20,000 WCU/s (50% capacity)\n`;
  report += `   - Trạng thái:     ${status}\n\n`;
  
  if (failedCount > 0 || successRate < 95) {
    report += `⚠️  KHUYẾN NGHỊ:\n`;
    report += `   - Kiểm tra CloudWatch Logs của Lambda VoteWorker\n`;
    report += `   - Xem DynamoDB throttle events\n`;
    report += `   - Review SQS DLQ messages\n\n`;
  }
  
  report += '='.repeat(70) + '\n';
  
  console.log(report);
  
  return {
    'stdout': report,
  };
}
