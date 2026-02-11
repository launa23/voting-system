# 📊 K6 STRESS TEST - VOTING SYSTEM

## 🎯 Mục đích
Stress test hệ thống voting để:
- Tìm throughput tối đa (requests/second)
- Đo latency ở các mức tải khác nhau
- Tìm breaking point
- Verify khả năng chịu tải cao

## 📦 Yêu cầu
- **k6**: Load testing tool
- **Terraform**: Đã deploy hệ thống
- **PowerShell**: Để chạy setup script

## 🚀 Cài đặt k6

### Windows (Chocolatey):
```powershell
choco install k6
```

### Windows (Manual):
Download từ: https://k6.io/docs/getting-started/installation/

### macOS:
```bash
brew install k6
```

### Linux:
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## 🏃 Chạy Stress Test

### Bước 1: Setup môi trường
```powershell
# Chạy script setup tự động
.\setup-stress-test.ps1
```

Script này sẽ:
1. ✅ Kiểm tra k6 đã cài chưa
2. ✅ Lấy API endpoint từ Terraform
3. ✅ Tạo test user và lấy JWT token
4. ✅ Tạo 5 test candidates
5. ✅ Tạo file config để chạy test

### Bước 2: Chạy stress test
```powershell
# Dùng script đã tạo sẵn
.\run-stress-test.ps1

# HOẶC chạy thủ công
$env:API_ENDPOINT='YOUR_API_ENDPOINT'
$env:AUTH_TOKEN='YOUR_JWT_TOKEN'
$env:CANDIDATE_IDS='candidate-1,candidate-2,candidate-3'
k6 run k6-stress-test.js
```

## 📋 Test Scenarios

Script bao gồm 5 scenarios chạy tuần tự:

### 1. **Warm Up** (0-40s)
- Tăng dần từ 0 → 100 concurrent users
- Mục đích: Làm ấm hệ thống, cache
- Duration: 30s

### 2. **Load Test** (40s-3m)
- Duy trì 500 concurrent users
- Mục đích: Test ở mức tải bình thường
- Duration: 2 phút

### 3. **Spike Test** (3m-5m)
- Tăng đột ngột: 500 → 2000 users
- Giữ ở 2000 users trong 1 phút
- Mục đích: Test khả năng auto-scaling
- Duration: 2 phút

### 4. **Stress Test** (5m-10m)
- Tăng dần requests/second:
  - 100 → 500 → 1000 → 2000 → 5000 → 10000 req/s
- Mục đích: Tìm breaking point
- Duration: 5 phút

### 5. **Read Performance** (10m-11m)
- Test GET /candidates
- 1000 requests/second
- Mục đích: Test read performance
- Duration: 1 phút

## 📊 Metrics

### Built-in Metrics:
- `http_req_duration`: Response time (p95, p99)
- `http_req_failed`: Error rate
- `http_reqs`: Total requests
- `iterations`: Total iterations
- `vus`: Virtual users

### Custom Metrics:
- `vote_success_rate`: % votes thành công
- `vote_duration`: Latency của vote API
- `duplicate_votes`: Số lần vote trùng (expected)
- `failed_votes`: Số lần vote thất bại (unexpected)

## 🎯 Thresholds (Pass/Fail)

```javascript
{
  'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
  'http_req_failed': ['rate<0.05'],                  // Error rate < 5%
  'vote_success_rate': ['rate>0.9'],                 // Success rate > 90%
  'vote_duration': ['p(95)<800'],                    // Vote p95 < 800ms
}
```

## 📈 Đọc kết quả

### Console Output:
```
     ✓ status is 200
     ✓ response time < 1000ms

     checks.........................: 95.00% ✓ 47500  ✗ 2500
     data_received..................: 142 MB 236 kB/s
     data_sent......................: 28 MB  47 kB/s
     http_req_duration..............: avg=245ms  p(95)=450ms p(99)=750ms
     http_req_failed................: 5.00%  ✗ 2500
     http_reqs......................: 50000  83.3/s
     iterations.....................: 50000  83.3/s
     vus............................: 500    min=0    max=2000
     vote_success_rate..............: 92.00% ✓ 46000  ✗ 4000
     vote_duration..................: avg=240ms  p(95)=430ms
```

### HTML Report:
```powershell
# Generate HTML report
k6 run --out json=results.json k6-stress-test.js
# Convert to HTML (cần cài k6-reporter)
```

## 🔧 Tùy chỉnh Test

### Thay đổi số lượng users:
```javascript
// Trong file k6-stress-test.js
load_test: {
  executor: 'constant-vus',
  vus: 1000,  // Thay đổi từ 500 → 1000
  duration: '5m',
}
```

### Thay đổi duration:
```javascript
stress_test: {
  stages: [
    { duration: '1m', target: 500 },   // Tăng từ 30s → 1m
    { duration: '1m', target: 1000 },
    // ...
  ],
}
```

### Chỉ chạy 1 scenario:
```powershell
# Chỉ chạy load test
k6 run --scenarios load_test k6-stress-test.js
```

## 🐛 Troubleshooting

### 1. "k6 not found"
```powershell
# Cài k6
choco install k6

# HOẶC download manual
# https://k6.io/docs/getting-started/installation/
```

### 2. "401 Unauthorized"
```powershell
# Token hết hạn, chạy lại setup
.\setup-stress-test.ps1
```

### 3. "Too many requests / Throttling"
- DynamoDB WCU không đủ → Tăng capacity
- Lambda throttling → Tăng concurrent executions
- API Gateway throttling → Tăng rate limit

### 4. "Connection timeout"
- SQS visibility timeout quá ngắn
- Lambda timeout quá ngắn
- Network issues

## 📊 Expected Results

### Optimal Performance:
- ✅ **Throughput**: 1000-2000 votes/second
- ✅ **P95 Latency**: < 500ms
- ✅ **P99 Latency**: < 1000ms
- ✅ **Error Rate**: < 5%
- ✅ **Success Rate**: > 90%

### Breaking Point (expected):
- ⚠️ **5000+ req/s**: DynamoDB throttling
- ⚠️ **10000+ req/s**: Lambda concurrency limit
- ⚠️ **15000+ req/s**: API Gateway limits

## 🎯 Optimization Tips

Nếu test fail:

### 1. Tăng DynamoDB Capacity:
```terraform
write_capacity = 5000  # Tăng từ 100 → 5000
```

### 2. Tăng Lambda Timeout:
```terraform
timeout = 60  # Tăng từ 10 → 60
```

### 3. Giảm Batch Size:
```terraform
batch_size = 10  # Giảm từ 100 → 10
```

### 4. Enable Auto Scaling:
```terraform
billing_mode = "PAY_PER_REQUEST"
```

## 📚 Tài liệu tham khảo

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/)

## 🎬 Quick Start

```powershell
# 1. Setup
.\setup-stress-test.ps1

# 2. Run test
.\run-stress-test.ps1

# 3. Analyze results
# Check console output for metrics
```

## 💡 Tips

1. **Chạy từ server gần API**: Giảm network latency
2. **Monitor AWS CloudWatch**: Xem real-time metrics
3. **Gradually increase load**: Tránh overwhelm hệ thống
4. **Save results**: So sánh giữa các lần test
5. **Test multiple times**: Đảm bảo consistency

Good luck! 🚀
