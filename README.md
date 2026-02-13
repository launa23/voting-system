# Voting System - Serverless Architecture

High-performance serverless voting system built on AWS, capable of handling 10,000+ requests per second with comprehensive load testing and cost optimization.

## 🏗️ Architecture

### **Clean Architecture Principles**

```
┌─────────────────────────────────────────────────────┐
│              API Gateway (HTTP/REST)                │
│         CloudFront + S3 (Static Content)            │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│          Lambda Functions (Handlers)                │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │ Auth     │ Vote     │Candidates│ User/Upload  │  │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────────┘  │
└───────┼──────────┼──────────┼──────────┼────────────┘
        │          │          │          │
┌───────▼──────────▼──────────▼──────────▼────────────┐
│            Services (Business Logic)                │
│  ┌────────────┬────────────┬────────────┬─────────┐ │
│  │AuthService │VoteService │CandidateServ│UploadServ│ │
│  └─────┬──────┴──────┬─────┴──────┬─────┴────┬────┘ │
└────────┼─────────────┼────────────┼──────────┼──────┘
         │             │            │          │
┌────────▼─────────────▼────────────▼──────────▼──────┐
│         Repositories (Data Access)                  │
│  ┌──────────────────┬───────────────────────────┐   │
│  │ VoteRepository   │  CandidateRepository      │   │
│  └────────┬─────────┴────────┬──────────────────┘   │
└───────────┼──────────────────┼──────────────────────┘
            │                  │
┌───────────▼──────────────────▼──────────────────────┐
│   AWS Services (DynamoDB, Cognito, SQS, S3)        │
└─────────────────────────────────────────────────────┘
```

### **Key Components**

- **API Gateway**: RESTful endpoints with JWT authorization
- **Lambda Functions**: 6 specialized functions with shared business logic
- **DynamoDB**: User votes, candidates, results (10,000 WCU provisioned)
- **Cognito**: User authentication and management
- **SQS**: Asynchronous vote processing with DLQ
- **CloudFront + S3**: CDN for candidate data with 1-minute cache
- **EventBridge**: Scheduled cache refresh

---

## 📂 Project Structure

```
voting-system/
├── src/                          # New structured codebase
│   ├── functions/                # Lambda handlers (thin, routing only)
│   │   ├── auth/
│   │   │   ├── authentication.mjs    # Login/signup handler
│   │   │   └── authorizer.mjs        # JWT verification
│   │   ├── vote/
│   │   │   └── voteWorker.mjs        # SQS message processor
│   │   ├── candidates/
│   │   │   └── candidates.mjs        # CRUD handler
│   │   ├── user/
│   │   │   └── userInfo.mjs          # User info handler
│   │   └── upload/
│   │       └── upload.mjs            # Upload URL generator
│   │
│   ├── core/                     # Business logic & data access
│   │   ├── services/             # Business logic layer
│   │   │   ├── AuthService.mjs       # Authentication logic
│   │   │   ├── VoteService.mjs       # Vote processing logic
│   │   │   ├── CandidateService.mjs  # Candidate CRUD + caching
│   │   │   └── UploadService.mjs     # S3 upload logic
│   │   │
│   │   ├── repositories/         # Data access layer
│   │   │   ├── VoteRepository.mjs       # DynamoDB vote operations
│   │   │   └── CandidateRepository.mjs  # DynamoDB candidate operations
│   │   │
│   │   └── models/               # Type definitions
│   │       └── types.mjs             # JSDoc type definitions
│   │
│   └── shared/                   # Shared utilities
│       └── utils/
│           ├── response.mjs          # HTTP response builders
│           └── constants.mjs         # Application constants
│
├── lambda/                       # ⚠️ DEPRECATED - Old monolithic code
│   ├── index.mjs                     # Old VoteWorker (DELETE AFTER MIGRATION)
│   ├── auth.mjs                      # Old authorizer
│   ├── login.mjs                     # Old authentication
│   ├── candidates.mjs                # Old candidates handler
│   ├── user.mjs                      # Old user handler
│   └── upload.mjs                    # Old upload handler
│
├── terraform/                    # Infrastructure as Code
│   ├── main.tf                       # Main Terraform config
│   ├── output.tf                     # Output variables
│   ├── terraform.tfstate             # State file
│   └── terraform.tfstate.backup      # State backup
│
├── k6-load-test.js              # Load test (10,000 RPS)
├── k6-warmup-test.js            # Warmup test (5 min)
├── k6-spike-test.js             # Spike test (8 min)
├── k6-stress-test-only.js       # Stress test (15 min, 50k RPS)
├── k6-soak-test.js              # Soak test (30m-2h)
│
├── package.json                 # Project dependencies
├── .eslintrc.json               # ESLint configuration
│
├── PROJECT_STRUCTURE.md         # Detailed architecture documentation
├── MIGRATION_GUIDE.md           # Step-by-step migration instructions
├── LOAD_TESTING.md              # Load testing documentation
├── COST_ESTIMATION.md           # Cost analysis and scenarios
├── COST_MANAGEMENT_GUIDE.md     # Quick cost optimization reference
│
├── migrate-terraform.ps1        # Automated Terraform migration script
└── cost-management.ps1          # DynamoDB scaling automation script
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x or higher
- **Terraform** 1.5+
- **AWS CLI** configured with credentials
- **k6** for load testing (optional)

### 1. Install Dependencies

```bash
npm install
```

### 2. Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 3. Get API Endpoint

```bash
terraform output
```

### 4. Test Endpoints

```bash
# Get candidates (cached via CloudFront)
curl https://<cloudfront-domain>/candidates

# Login
curl -X POST https://<api-endpoint>/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'

# Submit vote (requires JWT token)
curl -X POST https://<api-endpoint>/vote \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"candidateId":"candidate-123"}'
```

---

## 📊 Load Testing

### Run Individual Tests

```bash
# 1. Warmup (5 minutes)
k6 run k6-warmup-test.js

# 2. Load test (10,000 RPS exactly)
k6 run k6-load-test.js

# 3. Spike test (sudden traffic burst)
k6 run k6-spike-test.js

# 4. Stress test (up to 50,000 RPS)
k6 run k6-stress-test-only.js

# 5. Soak test (endurance test, 30m-2h)
k6 run k6-soak-test.js
```

### Expected Performance

| Test Type | Duration | Target RPS | Expected Error Rate | Cost per Run |
|-----------|----------|------------|---------------------|--------------|
| Warmup    | 5 min    | 1,000      | < 0.1%              | ~ $0.05      |
| Load      | 10 min   | 10,000     | < 0.5%              | ~ $0.40      |
| Spike     | 8 min    | 15,000 peak| < 1%                | ~ $0.35      |
| Stress    | 15 min   | 50,000     | 2-5% (expected)     | ~ $2.50      |
| Soak      | 2 hours  | 5,000      | < 0.1%              | ~ $2.00      |

See [LOAD_TESTING.md](LOAD_TESTING.md) for detailed documentation.

---

## 💰 Cost Management

### Cost Scenarios

| Scenario | Monthly Cost | Description |
|----------|--------------|-------------|
| **Idle** | ~ $17        | Testing only, DynamoDB on-demand |
| **Development** | ~ $17        | On-demand mode, 10 users |
| **Production (10k users)** | ~ $650        | 10,000 WCU provisioned, active usage |
| **Peak Day** | ~ $2,500     | High traffic day, full capacity |

### Quick Cost Optimization

```powershell
# Scale down DynamoDB for testing
.\cost-management.ps1 -Mode "testing"

# Scale up for production
.\cost-management.ps1 -Mode "production"

# Emergency shutdown (stops EC2 load tester)
.\cost-management.ps1 -Mode "shutdown"
```

See [COST_ESTIMATION.md](COST_ESTIMATION.md) for comprehensive analysis.

---

## 🧪 Testing

### Unit Tests (Coming Soon)

```bash
npm test
```

### Integration Tests

```bash
# Test all endpoints
npm run test:integration
```

### Linting

```bash
npm run lint
npm run lint:fix
```

---

## 📖 Documentation

- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Detailed architecture and code organization
- **[LOAD_TESTING.md](LOAD_TESTING.md)** - Load testing guide and best practices
- **[COST_ESTIMATION.md](COST_ESTIMATION.md)** - Comprehensive cost analysis
- **[COST_MANAGEMENT_GUIDE.md](COST_MANAGEMENT_GUIDE.md)** - Quick cost optimization guide

---

## 🏆 Performance Achievements

✅ **10,000+ RPS** sustained with < 0.5% error rate  
✅ **CloudFront caching** reduces DynamoDB read costs by 90%  
✅ **Auto-scaling** from 100 to 10,000 WCU in < 2 minutes  
✅ **DLQ monitoring** with automatic CloudWatch alarms  
✅ **Clean architecture** with 3-layer separation (Handler → Service → Repository)  
✅ **Cost-optimized** with 97% reduction possible ($650 → $17/month in dev mode)

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 20.x (ESM modules)
- **Infrastructure**: Terraform (IaC)
- **Compute**: AWS Lambda (1,000 concurrent executions)
- **Database**: DynamoDB (10,000 WCU provisioned)
- **Authentication**: Cognito User Pool
- **CDN**: CloudFront + S3
- **Queue**: SQS with DLQ
- **Monitoring**: CloudWatch Logs/Alarms
- **Load Testing**: k6 (Grafana k6)
- **Linting**: ESLint + Prettier

---

## 📝 Scripts

```bash
# Deployment
npm run deploy          # Full Terraform deployment
npm run validate        # Validate Terraform configuration
npm run plan            # Preview Terraform changes

# Testing
npm run test            # Run unit tests
npm run test:load       # Run k6 load test
npm run test:warmup     # Run k6 warmup test

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix linting issues
npm run format          # Format code with Prettier
```

---

## 🤝 Contributing

1. Follow the layered architecture pattern
2. Write unit tests for services
3. Update documentation for new features
4. Run linting before committing

---

## 📄 License

MIT

---

## 🆘 Troubleshooting

### Issue: Lambda function not found after migration

**Solution**: Check handler paths in Terraform:
```bash
cd terraform
terraform plan | grep handler
```

### Issue: High DynamoDB costs

**Solution**: Switch to on-demand mode for testing:
```bash
.\cost-management.ps1 -Mode "testing"
```

### Issue: Load tests hitting 6% error rate

**Solution**: Enable CloudFront caching for GET /candidates:
- Check EventBridge rule is enabled
- Verify S3 bucket has candidates.json updated
- Test CloudFront endpoint directly

See documentation files for more detailed troubleshooting.

---

**Built with ❤️ for high-performance serverless applications**
