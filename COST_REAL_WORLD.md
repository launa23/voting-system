# 💰 Chi phí Ước tính - Hệ thống Voting (Thực tế)

> **Lưu ý**: Chi phí dựa trên [AWS Pricing](https://aws.amazon.com/pricing/) khu vực **Singapore (ap-southeast-1)**.
> Không bao gồm chi phí Cognito và Free Tier.

---

## 📊 Tổng quan Quy mô

| Quy mô | Số cử tri | Số phiếu (peak/giây) | Thời gian bỏ phiếu | Ví dụ |
|--------|-----------|---------------------|-------------------|-------|
| **Nhỏ** | 10,000 | 10-50 req/s | 1 ngày | Bầu cử lớp trưởng, CLB |
| **Vừa** | 100,000 | 100-500 req/s | 1-3 ngày | Bầu cử trường ĐH, công ty |
| **Lớn** | 1,000,000 | 500-2,000 req/s | 1 tuần | Bầu cử cấp tỉnh/thành phố |
| **Toàn quốc** | 70,000,000 | 5,000-20,000 req/s | 1 ngày | Bầu cử Quốc hội VN |

---

## 🔢 Chi phí theo Dịch vụ AWS

### 1. **API Gateway (HTTP API)**

| Tier | Giá/triệu request |
|------|-------------------|
| 0 - 300M | $1.00 |
| 300M+ | $0.90 |

### 2. **Lambda**

| Metric | Giá |
|--------|-----|
| Requests | $0.20/triệu request |
| Duration | $0.0000166667/GB-giây |

*Config: 128MB RAM, avg 100ms/request*

### 3. **DynamoDB (On-Demand)**

| Operation | Giá |
|-----------|-----|
| Write Request (WRU) | $1.25/triệu |
| Read Request (RRU) | $0.25/triệu |
| Storage | $0.25/GB/tháng |

### 4. **SQS (Standard Queue)**

| Item | Giá |
|------|-----|
| Requests | $0.40/triệu request |
| Data transfer | $0.00 (trong region) |

### 5. **S3 (Ảnh ứng viên)**

| Item | Giá |
|------|-----|
| Storage | $0.023/GB/tháng |
| GET requests | $0.0004/1000 |
| PUT requests | $0.005/1000 |

### 6. **CloudFront (CDN)**

| Tier | Giá/GB |
|------|--------|
| 0 - 10TB | $0.120 |
| 10TB+ | $0.085 |

---

## 📈 Kịch bản Chi phí Chi tiết

### 🏫 Kịch bản 1: Quy mô Nhỏ (10,000 cử tri)

**Giả định:**
- 10,000 phiếu bầu trong 1 ngày
- 50 ứng viên, mỗi ứng viên 1 ảnh 500KB
- Peak: 50 req/s
- Mỗi user xem trung bình 5 lần

| Dịch vụ | Số lượng | Đơn giá | Chi phí |
|---------|----------|---------|---------|
| **API Gateway** | | | |
| - POST /vote | 10,000 | $1/1M | $0.01 |
| - GET /candidates | 50,000 | $1/1M | $0.05 |
| - Các API khác | 30,000 | $1/1M | $0.03 |
| **Lambda** | | | |
| - VoteWorker (100 batch) | 100 invoke | $0.20/1M | $0.00 |
| - Duration (128MB × 100ms) | 100 | $0.0000166667 | $0.00 |
| - Các Lambda khác | 90,000 | | $0.02 |
| **DynamoDB** | | | |
| - Write (vote + history) | 20,000 WRU | $1.25/1M | $0.025 |
| - Read (candidates) | 50,000 RRU | $0.25/1M | $0.013 |
| - Storage | 0.01 GB | $0.25/GB | $0.003 |
| **SQS** | | | |
| - Send + Receive + Delete | 30,000 | $0.40/1M | $0.012 |
| **S3** | | | |
| - Storage (25MB) | 0.025 GB | $0.023/GB | $0.001 |
| - GET requests | 50,000 | $0.0004/1K | $0.02 |
| **CloudFront** | | | |
| - Data transfer | 1.25 GB | $0.12/GB | $0.15 |

### 💵 **Tổng chi phí: ~$0.31 (< 10,000 VND)**

---

### 🏢 Kịch bản 2: Quy mô Vừa (100,000 cử tri)

**Giả định:**
- 100,000 phiếu bầu trong 3 ngày
- 100 ứng viên, mỗi ứng viên 1MB ảnh
- Peak: 500 req/s
- Mỗi user xem trung bình 10 lần

| Dịch vụ | Số lượng | Chi phí |
|---------|----------|---------|
| **API Gateway** | 1.3M requests | $1.30 |
| **Lambda** | 1.3M invokes, duration | $0.50 |
| **DynamoDB** | | |
| - Write | 200K WRU | $0.25 |
| - Read | 1M RRU | $0.25 |
| - Storage | 0.1 GB | $0.03 |
| **SQS** | 300K requests | $0.12 |
| **S3** | 100MB + 1M GET | $0.40 |
| **CloudFront** | 100 GB | $12.00 |

### 💵 **Tổng chi phí: ~$14.85 (~370,000 VND)**

---

### 🏛️ Kịch bản 3: Quy mô Lớn (1,000,000 cử tri)

**Giả định:**
- 1,000,000 phiếu bầu trong 1 tuần
- 500 ứng viên, mỗi ứng viên 2MB ảnh (profile + banner)
- Peak: 2,000 req/s
- Mỗi user xem trung bình 20 lần

| Dịch vụ | Số lượng | Chi phí |
|---------|----------|---------|
| **API Gateway** | 25M requests | $25.00 |
| **Lambda** | | |
| - Invocations | 25M | $5.00 |
| - Duration (128MB × 100ms) | 25M | $5.21 |
| **DynamoDB** | | |
| - Write | 2M WRU | $2.50 |
| - Read | 20M RRU | $5.00 |
| - Storage | 1 GB | $0.25 |
| **SQS** | 3M requests | $1.20 |
| **S3** | 1GB + 20M GET | $8.00 |
| **CloudFront** | 2 TB | $240.00 |
| **CloudWatch** | Logs + Metrics | $10.00 |

### 💵 **Tổng chi phí: ~$302 (~7,550,000 VND)**

---

### 🇻🇳 Kịch bản 4: Toàn quốc (70,000,000 cử tri)

**Giả định:**
- 70,000,000 phiếu bầu trong 1 ngày (12 giờ hoạt động)
- 500 ứng viên Quốc hội, 3MB ảnh/ứng viên
- Peak: 20,000 req/s (burst lên 50,000)
- DynamoDB: **Provisioned với Auto-scaling** (tiết kiệm chi phí)
- CloudFront cache 1 phút cho data ứng viên

| Dịch vụ | Số lượng | Chi phí |
|---------|----------|---------|
| **API Gateway** | 500M requests | $500.00 |
| **Lambda** | | |
| - Invocations | 500M | $100.00 |
| - Duration (128MB × 100ms) | 500M | $104.17 |
| - Provisioned Concurrency (1000) | 12 giờ | $54.00 |
| **DynamoDB (Provisioned)** | | |
| - Write Capacity (10,000 WCU × 12h) | | $79.20 |
| - Read Capacity (5,000 RCU × 12h) | | $7.92 |
| - Write Requests | 140M WRU | overflow on-demand: $50.00 |
| - Storage | 10 GB | $2.50 |
| **SQS** | 210M requests | $84.00 |
| **S3** | 1.5GB + 500M GET | $200.00 |
| **CloudFront** | | |
| - Data transfer (cache hit 95%) | 10 TB | $850.00 |
| - Requests | 1 tỷ | $100.00 |
| **CloudWatch** | | |
| - Logs (1TB) | | $50.00 |
| - Metrics + Alarms | | $30.00 |
| **Data Transfer Out** | 500 GB | $45.00 |

### 💵 **Tổng chi phí: ~$2,257 (~56,500,000 VND)**

---

## 📊 Bảng So sánh Tổng hợp

| Quy mô | Số cử tri | Chi phí USD | Chi phí VND | Chi phí/phiếu |
|--------|-----------|-------------|-------------|---------------|
| **Nhỏ** | 10,000 | $0.31 | ~8,000 | 0.8 VND |
| **Vừa** | 100,000 | $14.85 | ~370,000 | 3.7 VND |
| **Lớn** | 1,000,000 | $302 | ~7,550,000 | 7.5 VND |
| **Toàn quốc** | 70,000,000 | $2,257 | ~56,500,000 | 0.8 VND |

> 💡 **Nhận xét**: Chi phí/phiếu giảm đáng kể ở quy mô lớn nhờ economies of scale và CloudFront cache.

---

## 🎯 Tối ưu Chi phí

### Đề xuất theo Quy mô

| Quy mô | DynamoDB Mode | Lambda | CloudFront |
|--------|---------------|--------|------------|
| Nhỏ | On-Demand | Không cần Provisioned | Không cần |
| Vừa | On-Demand | Không cần Provisioned | Cache 5 phút |
| Lớn | On-Demand hoặc Provisioned | Provisioned Concurrency 500 | Cache 1 phút |
| Toàn quốc | **Provisioned + Auto-scaling** | **Provisioned Concurrency 1000** | **Cache 1 phút** |

### Tips Tiết kiệm

1. **DynamoDB Provisioned** thay On-Demand khi biết trước traffic pattern
   - Tiết kiệm ~70% so với On-Demand ở high volume

2. **CloudFront Cache** cho data ít thay đổi
   - Candidates list cache 5 phút → giảm 90% Lambda calls
   - Ảnh cache 24 giờ → gần như 0 S3 GET

3. **Lambda Batch Processing**
   - Batch size 100 → giảm 99% invocations cho VoteWorker
   - Tiết kiệm ~$50 ở quy mô toàn quốc

4. **Reserved Capacity** (cam kết 1-3 năm)
   - Tiết kiệm 30-75% cho DynamoDB
   - Savings Plans cho Lambda

---

## ⚠️ Chi phí Ẩn Cần Lưu ý

| Hạng mục | Mô tả | Ước tính |
|----------|-------|----------|
| **CloudWatch Logs** | Log từ Lambda, API Gateway | +5-10% tổng chi phí |
| **Data Transfer** | Outbound traffic ra Internet | +3-5% |
| **NAT Gateway** | Nếu Lambda cần VPC | +$32/tháng + $0.045/GB |
| **WAF** | Web Application Firewall | +$5/tháng + $0.60/1M req |
| **Alarm/Monitoring** | CloudWatch Alarms | +$0.10/alarm/tháng |

---

## 🆚 So sánh với Phương án Truyền thống

| Hạng mục | Serverless (AWS) | Server Truyền thống |
|----------|------------------|---------------------|
| **Chi phí 10K phiếu** | $0.31 | ~$50/tháng (VPS) |
| **Chi phí 70M phiếu** | $2,257 | $5,000-10,000+ |
| **Scale** | Tự động | Cần setup thủ công |
| **Downtime** | Gần như 0 | Có rủi ro |
| **Bảo trì** | Không cần | Cần DevOps |

> ✅ **Kết luận**: Serverless tiết kiệm đáng kể ở mọi quy mô, đặc biệt với workload không đều (bỏ phiếu chỉ diễn ra trong thời gian ngắn).

---

## 📝 Lưu ý

1. **Free Tier AWS** (12 tháng đầu):
   - Lambda: 1M requests/tháng miễn phí
   - DynamoDB: 25GB storage, 25 WCU, 25 RCU miễn phí
   - S3: 5GB storage miễn phí
   - → Quy mô nhỏ có thể **hoàn toàn miễn phí**!

2. **Tỷ giá**: Sử dụng 1 USD = 25,000 VND

3. **Thời điểm tính toán**: Tháng 2/2026

---

*Tài liệu được tạo tự động bởi Gemini Code Assist*
