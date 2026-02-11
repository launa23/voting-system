# Load Testing Guide - Voting System

## 🎯 System Configuration

**Production Setup:**
- **DynamoDB WCU**: 10,000 (provisioned)
- **Lambda Concurrent**: 1,000 executions
- **k6 Client**: EC2 c6i.xlarge (4 vCPU, 8GB RAM)
- **CloudFront**: CDN with 1-minute cache

---

## 📊 Quick Reference - Test Comparison

| Test Type | File | Duration | Target | Purpose | Cost |
|-----------|------|----------|--------|---------|------|
| **Warmup** | k6-warmup-test.js | 5m | 2k req/s | Eliminate cold starts | $0.13 |
| **Load** | k6-load-test.js | 10m | 10-12k req/s | Sustained capacity | $0.50 |
| **Spike** | k6-spike-test.js | 8m | 35-40k req/s peak | Burst handling | $1.15 |
| **Stress** | k6-stress-test-only.js | 15m | 50k req/s (limit) | Find breaking point | $1.84 |
| **Soak** | k6-soak-test.js | 30m-2h | 6-8k req/s | Long-term stability | $2.28-$17.52 |

**Recommended Sequence:** Warmup → Load → Spike → (Optional: Stress/Soak)

---

## 📁 Test Files (Modular Structure)

All tests are separated into individual files for independent execution and CI/CD integration.

### 1. **k6-warmup-test.js** - Warmup (5 minutes)
Eliminate Lambda cold starts before main tests.

**Purpose:**
- Warm up Lambda functions
- Initialize auto-scaling
- Reduce cold start impact on main tests
- Verify system readiness

**Usage:**
```powershell
k6 run k6-warmup-test.js
```

**Pattern:**
- Gradual ramp: 0 → 50 → 150 → 200 VUs over 5 minutes
- Expected throughput: 500-2,000 req/s
- Relaxed thresholds (p95 <1000ms)

**When to run:**
- Before any major load test
- After infrastructure changes
- After Lambda deployments

---

### 2. **k6-load-test.js** - Load Test (10 minutes)
Sustained high throughput testing at expected production load.

**Purpose:**
- Test sustained capacity
- Verify 10,000 WCU DynamoDB handles load
- Validate 1,000 Lambda concurrent executions
- Measure steady-state performance

**Usage:**
```powershell
k6 run k6-load-test.js
```

**Target:**
- **10,000-12,000 req/s sustained** (10m)
- 300 VUs constant load (votes)
- 2,500 req/s CloudFront reads
- Expected latency: p95 <500ms
- Error rate: <1%

**Expected Results:**
- DynamoDB utilization: 40-50% (4,000-5,000 WCU)
- Lambda concurrent: 400-500
- Total requests: ~6-7 million
- Success rate: >99%

---

### 3. **k6-spike-test.js** - Spike Test (8 minutes)
Test sudden 6x traffic surges to verify auto-scaling.

**Purpose:**
- Validate auto-scaling responsiveness
- Test burst capacity
- Verify graceful degradation
- Check recovery after spike

**Usage:**
```powershell
k6 run k6-spike-test.js
```

**Peak Target:**
- **35,000-40,000 req/s** (during spike)
- Surge: 200 → 1,200 VUs in 30 seconds
- Hold spike for 2 minutes
- CloudFront peak: 10,000 req/s

**Expected Behavior:**
- Initial spike: Some errors acceptable (<5%)
- After 30s: System should stabilize
- Latency during spike: p95 <800ms
- Recovery: Fast (within 1 minute)

---

### 4. **k6-stress-test-only.js** - Stress Test (15 minutes)
Find breaking point by pushing to extreme load.

**Purpose:**
- Find maximum system capacity
- Identify bottlenecks
- Test failure modes
- Discover breaking point

**Usage:**
```powershell
k6 run k6-stress-test-only.js
```

**Progressive Load:**
- 2m: 5,000 req/s (safe)
- 2m: 10,000 req/s (DynamoDB limit)
- 2m: 15,000 req/s (expect throttling)
- 2m: 20,000 req/s (heavy throttling)
- 2m: 30,000 req/s (breaking point)
- 2m: 40,000 req/s (extreme)
- 2m: 50,000 req/s (find absolute limit)

**Expected:**
- Throttling starts at ~10,000 req/s (DynamoDB WCU limit)
- Lambda may throttle at >30,000 req/s
- Error rate will increase beyond capacity
- System should gracefully degrade (no crashes)

---

### 5. **k6-soak-test.js** - Soak Test (30m - 2h)
Long-running endurance tests to detect degradation and leaks.

**Purpose:**
- Detect memory leaks
- Identify performance degradation over time
- Test resource exhaustion
- Verify long-term stability

**Usage:**
```powershell
# Full soak test suite (2h+)
k6 run k6-soak-test.js

# Run specific scenario (recommended)
k6 run k6-soak-test.js --scenario soak_moderate      # 30 minutes
k6 run k6-soak-test.js --scenario soak_sustained     # 1 hour
k6 run k6-soak-test.js --scenario soak_cloudfront    # 2 hours
k6 run k6-soak-test.js --scenario soak_mixed_reads   # 1 hour
```

**Scenarios:**
- `soak_moderate`: 200 VUs for 30m (~6k req/s)
- `soak_sustained`: 250 VUs for 1h (~8k req/s)
- `soak_cloudfront`: 3k req/s for 2h
- `soak_mixed_reads`: 500 req/s for 1h

**Expected Results:**
- Total requests: 10-30 million
- p95 latency: <800ms (may degrade slightly)
- Error rate: <1%
- Success rate: >98%
- No memory leaks (stable Lambda memory)

---

## 🖥️ System Requirements

### k6 Client (EC2)
- **Instance Type**: c6i.xlarge (recommended)
- **CPU**: 4 vCPU
- **RAM**: 8GB
- **Network**: Enhanced networking enabled
- **OS**: Amazon Linux 2 or Ubuntu 20.04+
- **k6 Version**: v0.40+

### Backend Infrastructure (Production Config)
- **DynamoDB WCU**: 10,000 (provisioned)
- **DynamoDB RCU**: 100 (on-demand for reads)
- **Lambda Concurrency**: 1,000 reserved executions
- **SQS**: Unlimited throughput
- **CloudFront**: CDN with 1-minute cache
- **CloudWatch**: Detailed monitoring enabled

---

## 📊 Monitoring During Tests

### Critical Metrics to Watch

**1. CloudWatch Dashboard:**
```
https://console.aws.amazon.com/cloudwatch/
```
- API Gateway: Count, Latency, 5xx errors
- Lambda: ConcurrentExecutions, Throttles, Duration
- DynamoDB: ConsumedWriteCapacity, WriteThrottleEvents
- SQS: ApproximateNumberOfMessagesVisible

**2. Real-time Monitoring:**
```powershell
# Terminal 1: Run k6 test
k6 run k6-stress-test.js

# Terminal 2: Watch CloudWatch metrics
aws cloudwatch get-metric-statistics --namespace AWS/Lambda ...

# Terminal 3: Monitor SQS
aws sqs get-queue-attributes --queue-url <URL> --attribute-names All
```

**3. Abort Criteria:**
- Error rate > 5%: Stop immediately
- p95 latency > 2s: Investigate backend
- DynamoDB throttling > 100/min: Increase WCU
- Lambda throttles > 10: Increase concurrency

---

## 🎯 Test Strategy

### Recommended Test Sequence

**Phase 1: Warmup (5 minutes)**
```powershell
k6 run k6-warmup-test.js
```
- Eliminate cold starts
- Initialize auto-scaling
- Prepare system for load tests

**Phase 2: Load Test (10 minutes)**
```powershell
k6 run k6-load-test.js
```
- Validate production capacity (20k-25k req/s)
- Confirm 10,000 WCU DynamoDB handles load
- Verify steady-state performance

**Phase 3: Spike Test (8 minutes)**
```powershell
k6 run k6-spike-test.js
```
- Test 6x traffic surge (40k req/s peak)
- Validate auto-scaling
- Check recovery behavior

**Phase 4: Stress Test (15 minutes - Optional)**
```powershell
k6 run k6-stress-test-only.js
```
- Find breaking point (push to 50k req/s)
- Identify bottlenecks
- Discover system limits

**Phase 5: Soak Test (30m-2h - Optional)**
```powershell
k6 run k6-soak-test.js --scenario soak_moderate
```
- Detect memory leaks
- Verify long-term stability
- Check for degradation

### Quick Validation (13 minutes)
```powershell
# Fast validation before deployment
k6 run k6-warmup-test.js
k6 run k6-load-test.js
```

### Full Test Suite (~40 minutes)
```powershell
# Comprehensive testing
k6 run k6-warmup-test.js      # 5m
k6 run k6-load-test.js        # 10m
k6 run k6-spike-test.js       # 8m
k6 run k6-stress-test-only.js # 15m
```

### CI/CD Integration
```powershell
# Automated pipeline
k6 run k6-warmup-test.js && \
k6 run k6-load-test.js --out json=load-results.json
# Fail pipeline if thresholds not met
```

---

## 📈 Expected Throughput by Instance

| EC2 Instance | vCPU | RAM | Max Throughput | Dropped Iterations |
|--------------|------|-----|----------------|--------------------|
| t3.medium    | 2    | 4GB | ~2,000 req/s   | 5-10% |
| c6i.large    | 2    | 4GB | ~5,000 req/s   | 1-2% |
| c6i.xlarge   | 4    | 8GB | **12,000 req/s** | **<1%** |
| c6i.2xlarge  | 8    | 16GB| ~25,000 req/s  | <0.5% |

---

## 💰 Cost Estimation (10,000 WCU Configuration)

### Warmup Test (5 minutes)
- EC2 c6i.xlarge: $0.03
- DynamoDB WCU (20% utilization): $0.05
- Lambda: $0.03
- API Gateway: $0.02
- **Total**: ~$0.13

### Load Test (10 minutes)
- EC2 c6i.xlarge: $0.06
- DynamoDB WCU (85% utilization): $0.45
- Lambda: $0.20
- API Gateway: $0.15
- CloudFront: $0.05
- **Total**: ~$0.91

### Spike Test (8 minutes)
- EC2 c6i.xlarge: $0.05
- DynamoDB WCU (peak 100%): $0.50
- Lambda: $0.30
- API Gateway: $0.20
- CloudFront: $0.10
- **Total**: ~$1.15

### Stress Test (15 minutes)
- EC2 c6i.xlarge: $0.09
- DynamoDB WCU (high throttling): $0.80
- Lambda: $0.50
- API Gateway: $0.30
- CloudFront: $0.15
- **Total**: ~$1.84

### Soak Test - Moderate (30 minutes)
- EC2 c6i.xlarge: $0.18
- DynamoDB WCU (60% utilization): $0.90
- Lambda: $0.60
- API Gateway: $0.40
- CloudFront: $0.20
- **Total**: ~$2.28

### Soak Test - Full (2 hours)
- EC2 c6i.xlarge: $0.72
- DynamoDB WCU: $7.20
- Lambda: $4.80
- API Gateway: $3.20
- CloudFront: $1.60
- **Total**: ~$17.52

### Full Test Suite (Warmup + Load + Spike + Stress)
**Total Duration**: ~40 minutes
**Total Cost**: ~$4.03

---

## 🐛 Troubleshooting

### Issue: High Dropped Iterations (>5%)
**Cause:** k6 client overloaded
**Fix:** 
- Reduce VUs or arrival rate
- Upgrade EC2 instance
- Run distributed k6 on multiple instances

### Issue: High p95 Latency (>500ms)
**Cause:** Backend throttling or cold starts
**Fix:**
- Increase DynamoDB WCU
- Increase Lambda reserved concurrency
- Check SQS backlog

### Issue: Error Rate >1%
**Cause:** System overload
**Fix:**
- Check CloudWatch for specific errors
- Review Lambda logs
- Verify DynamoDB capacity

### Issue: Memory Leak in Soak Test
**Cause:** Lambda or application code issue
**Fix:**
- Review Lambda memory metrics
- Check for unclosed connections
- Analyze Lambda code for leaks

---

## 📝 Example Commands

### Basic Test Execution
```powershell
# Warmup (always run first)
k6 run k6-warmup-test.js

# Load test (production capacity)
k6 run k6-load-test.js

# Spike test (burst testing)
k6 run k6-spike-test.js

# Stress test (find limits)
k6 run k6-stress-test-only.js

# Soak test - specific scenario
k6 run k6-soak-test.js --scenario soak_moderate
```

### Custom Configuration
```powershell
# Custom API endpoint
k6 run -e API_ENDPOINT=https://your-api.com k6-load-test.js

# Custom auth token
k6 run -e AUTH_TOKEN=your-token k6-load-test.js

# Multiple environment variables
k6 run \
  -e API_ENDPOINT=https://your-api.com \
  -e CLOUDFRONT_URL=https://your-cdn.com/candidates.json \
  k6-load-test.js
```

### Output and Reporting
```powershell
# JSON output
k6 run k6-load-test.js --out json=load-results.json

# CSV output
k6 run k6-load-test.js --out csv=load-results.csv

# Multiple outputs
k6 run k6-load-test.js \
  --out json=results.json \
  --out influxdb=http://localhost:8086/k6
```

### InfluxDB/Grafana Integration
```powershell
# Send metrics to InfluxDB
k6 run k6-load-test.js --out influxdb=http://localhost:8086/k6

# With authentication
k6 run k6-load-test.js \
  --out influxdb=http://localhost:8086/k6?username=admin&password=admin
```

### Sequential Test Execution
```powershell
# PowerShell - Full suite with delays
k6 run k6-warmup-test.js
Start-Sleep -Seconds 60
k6 run k6-load-test.js
Start-Sleep -Seconds 120
k6 run k6-spike-test.js
Start-Sleep -Seconds 120
k6 run k6-stress-test-only.js
```

### Parallel Testing (Multiple k6 instances)
```powershell
# Terminal 1: Vote load
k6 run k6-load-test.js

# Terminal 2: Read load (separate CloudFront test)
k6 run k6-soak-test.js --scenario soak_cloudfront
```

---

## ✅ Success Criteria

### Warmup Test
- ✅ No errors during warmup
- ✅ All Lambda functions warmed
- ✅ Auto-scaling initialized
- ✅ p95 latency < 1000ms (cold starts acceptable)

### Load Test
- ✅ Throughput ≥ 20,000 req/s sustained
- ✅ Error rate < 1%
- ✅ p95 latency < 500ms
- ✅ DynamoDB utilization 80-90%
- ✅ No Lambda throttles

### Spike Test
- ✅ Peak throughput ≥ 35,000 req/s
- ✅ Error rate < 5% (during spike)
- ✅ p95 latency < 800ms
- ✅ System recovers within 1 minute
- ✅ No crashes or timeouts

### Stress Test
- ✅ Breaking point identified
- ✅ Graceful degradation (no crashes)
- ✅ DynamoDB throttling observed at ~10k req/s
- ✅ Error rate < 50% (at extreme load)
- ✅ System recovers after ramp-down

### Soak Test
- ✅ Error rate < 1% (entire duration)
- ✅ p95 latency < 800ms
- ✅ No memory leaks (stable Lambda memory)
- ✅ No performance degradation > 20%
- ✅ DLQ remains empty
