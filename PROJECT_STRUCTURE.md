# 🏗️ Project Structure - Voting System

## 📂 Cấu Trúc Thư Mục Mới

```
voting-system/
├── src/                           # Source code chính
│   ├── functions/                 # Lambda Handlers (Thin Layer)
│   │   ├── auth/
│   │   │   ├── authentication.mjs # Handler cho login/signup/confirm
│   │   │   └── authorizer.mjs     # JWT authorizer
│   │   ├── vote/
│   │   │   └── voteWorker.mjs     # SQS → DynamoDB processor
│   │   ├── candidates/
│   │   │   └── candidates.mjs     # CRUD candidates
│   │   ├── user/
│   │   │   └── userInfo.mjs       # Get user info
│   │   └── upload/
│   │       └── upload.mjs         # Generate upload URLs
│   │
│   ├── core/                      # Business Logic (QUAN TRỌNG)
│   │   ├── services/              # Business logic layer
│   │   │   ├── AuthService.mjs    # Authentication logic
│   │   │   ├── CandidateService.mjs # Candidate operations
│   │   │   ├── VoteService.mjs    # Voting logic
│   │   │   └── UploadService.mjs  # Upload logic
│   │   │
│   │   ├── repositories/          # Data access layer
│   │   │   ├── VoteRepository.mjs      # DynamoDB vote operations
│   │   │   └── CandidateRepository.mjs # DynamoDB candidate operations
│   │   │
│   │   └── models/                # Data models & types
│   │       └── types.mjs          # Type definitions (JSDoc)
│   │
│   └── shared/                    # Code dùng chung
│       └── utils/
│           ├── response.mjs       # Response builders & custom errors
│           └── constants.mjs      # Application constants
│
├── lambda/                        # ⚠️ DEPRECATED - Old structure
│   └── *.mjs                      # Sẽ migrate sang src/
│
├── terraform/                     # Infrastructure as Code
│   └── main.tf                    # Cần update paths
│
├── user/                          # Frontend
├── tests/                         # Unit & Integration tests (TODO)
└── package.json                   # Dependencies
```

---

## 🎯 Architecture Principles

### 1. **Separation of Concerns**

**❌ Before (Monolithic):**
```javascript
// lambda/index.mjs - Everything in one file
export const handler = async (event) => {
  const batchItemFailures = [];
  
  event.Records.map(async (record) => {
    const body = JSON.parse(record.body);
    const { userId, candidateId } = body;
    
    // Validation ❌
    if (!userId || !candidateId) { }
    
    // Database access ❌
    await docClient.send(new TransactWriteCommand({ }));
    
    // Error handling ❌
    if (err.name === 'TransactionCanceledException') { }
  });
  
  return { batchItemFailures };
};
```

**✅ After (Layered):**
```javascript
// src/functions/vote/voteWorker.mjs - Thin handler
export const handler = async (event) => {
  const batchItemFailures = await voteService.processBatchVotes(event.Records);
  return { batchItemFailures };
};

// src/core/services/VoteService.mjs - Business logic
export class VoteService {
  async processBatchVotes(records) {
    // Validation ✅
    // Error handling ✅
    // Call repository ✅
  }
}

// src/core/repositories/VoteRepository.mjs - Data access
export class VoteRepository {
  async processVote(userId, candidateId) {
    // Database operations only ✅
  }
}
```

---

### 2. **Testability**

**Old:** Không thể test logic mà không chạy Lambda

**New:** Test từng layer riêng biệt:
```javascript
// tests/services/VoteService.test.mjs
describe('VoteService', () => {
  it('should reject invalid vote data', async () => {
    await expect(voteService.processVote(null, 'cand1'))
      .rejects.toThrow(ValidationError);
  });
});
```

---

### 3. **Reusability**

**Shared utilities:**
```javascript
// src/shared/utils/response.mjs
import { successResponse, errorResponse } from '../../shared/utils/response.mjs';

// Dùng chung cho tất cả handlers
return successResponse(200, data);
```

---

## 🔄 Migration Guide

### Step 1: Update Terraform Paths

```hcl
# terraform/main.tf

# OLD:
data "archive_file" "lambda_zip" {
  source_file = "${path.module}/../lambda/index.mjs"
  output_path = "${path.module}/payload.zip"
}

# NEW:
data "archive_file" "vote_worker_zip" {
  source_dir  = "${path.module}/../src"
  output_path = "${path.module}/vote-worker.zip"
}

resource "aws_lambda_function" "vote_worker" {
  filename         = data.archive_file.vote_worker_zip.output_path
  handler          = "functions/vote/voteWorker.handler"  # ← New path
  runtime          = "nodejs20.x"
}
```

### Step 2: Update All Lambda Functions

```hcl
# Authentication
resource "aws_lambda_function" "auth_func" {
  handler = "functions/auth/authentication.handler"
}

# Authorizer
resource "aws_lambda_function" "authorizer_func" {
  handler = "functions/auth/authorizer.handler"
}

# Candidates
resource "aws_lambda_function" "candidates_func" {
  handler = "functions/candidates/candidates.handler"
}

# User Info
resource "aws_lambda_function" "user_func" {
  handler = "functions/user/userInfo.handler"
}

# Upload
resource "aws_lambda_function" "upload_func" {
  handler = "functions/upload/upload.handler"
}
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Build & Deploy

```bash
# Build (if using TypeScript transpilation)
npm run build

# Deploy
cd terraform
terraform apply
```

---

## 📦 Package Structure

### Dependencies Management

```json
{
  "name": "voting-system",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "jest",
    "lint": "eslint src/",
    "build": "echo 'No build needed for pure JS'",
    "deploy": "cd terraform && terraform apply"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.x",
    "@aws-sdk/lib-dynamodb": "^3.x",
    "@aws-sdk/client-cognito-identity-provider": "^3.x",
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/s3-request-presigner": "^3.x",
    "aws-jwt-verify": "^4.x"
  },
  "devDependencies": {
    "jest": "^29.x",
    "eslint": "^8.x"
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests (Services)

```javascript
// tests/core/services/CandidateService.test.mjs
import { candidateService } from '../../../src/core/services/CandidateService.mjs';

describe('CandidateService', () => {
  test('should throw error for missing name', async () => {
    await expect(candidateService.createCandidate({}))
      .rejects.toThrow('Candidate name is required');
  });
});
```

### Integration Tests (Repositories)

```javascript
// tests/core/repositories/VoteRepository.test.mjs
import { voteRepository } from '../../../src/core/repositories/VoteRepository.mjs';

describe('VoteRepository', () => {
  test('should prevent duplicate votes', async () => {
    const userId = 'test-user';
    const candidateId = 'cand1';
    
    await voteRepository.processVote(userId, candidateId);
    
    await expect(voteRepository.processVote(userId, candidateId))
      .rejects.toThrow('TransactionCanceledException');
  });
});
```

---

## 🚀 Benefits

| Before | After |
|--------|-------|
| ❌ Logic trộn lẫn trong handlers | ✅ Tách biệt rõ ràng (Handler → Service → Repository) |
| ❌ Khó test | ✅ Test từng layer riêng |
| ❌ Duplicate code (response format) | ✅ Shared utilities |
| ❌ Hard-coded values | ✅ Constants file |
| ❌ Không có type hints | ✅ JSDoc type definitions |
| ❌ Mỗi Lambda 1 file độc lập | ✅ Share common logic |

---

## 📝 Code Examples

### Creating a New Feature

**1. Add Service Method:**
```javascript
// src/core/services/CandidateService.mjs
export class CandidateService {
  async searchCandidates(query) {
    // Business logic
    const candidates = await candidateRepository.search(query);
    return candidates.filter(c => c.name.includes(query));
  }
}
```

**2. Add Repository Method:**
```javascript
// src/core/repositories/CandidateRepository.mjs
export class CandidateRepository {
  async search(query) {
    // Database access only
    return await docClient.send(new ScanCommand({ }));
  }
}
```

**3. Add Handler:**
```javascript
// src/functions/candidates/search.mjs
export const handler = async (event) => {
  const { query } = parseBody(event);
  const results = await candidateService.searchCandidates(query);
  return successResponse(200, { results });
};
```

---

## 🔧 Maintenance

### Adding New Lambda Function

1. Create handler in `src/functions/<domain>/<name>.mjs`
2. Create service if needed in `src/core/services/`
3. Create repository if needed in `src/core/repositories/`
4. Add Terraform resource in `terraform/main.tf`
5. Deploy: `terraform apply`

### Updating Existing Function

1. Update business logic in `src/core/services/`
2. Tests still pass (no handler changes needed)
3. Deploy: `terraform apply`

---

**Benefits Summary:**
- ✅ **Maintainability**: Easy to find and update code
- ✅ **Testability**: Test business logic without AWS
- ✅ **Scalability**: Share code across functions
- ✅ **Clarity**: Clear separation of concerns
