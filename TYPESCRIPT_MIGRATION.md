# TypeScript Migration Guide

## ✅ Migration Completed

Toàn bộ mã nguồn trong thư mục `src/` đã được chuyển đổi từ JavaScript (.mjs) sang TypeScript (.ts) **mà không thay đổi logic nghiệp vụ**.

---

## 📊 Summary of Changes

### Files Converted: **16 TypeScript files**

#### **1. Core Models (1 file)**
- ✅ `src/core/models/types.ts` - Type definitions (từ JSDoc sang TypeScript interfaces)

#### **2. Shared Utilities (2 files)**
- ✅ `src/shared/utils/constants.ts` - Application constants
- ✅ `src/shared/utils/response.ts` - HTTP response builders và custom errors

#### **3. Repositories (2 files)**
- ✅ `src/core/repositories/VoteRepository.ts` - Vote data access with sharding
- ✅ `src/core/repositories/CandidateRepository.ts` - Candidate data access

#### **4. Services (4 files)**
- ✅ `src/core/services/VoteService.ts` - Vote business logic
- ✅ `src/core/services/CandidateService.ts` - Candidate business logic
- ✅ `src/core/services/AuthService.ts` - Authentication business logic
- ✅ `src/core/services/UploadService.ts` - S3 upload business logic

#### **5. Lambda Handlers (6 files)**
- ✅ `src/functions/vote/voteWorker.ts` - SQS vote processor
- ✅ `src/functions/auth/authentication.ts` - Login/signup/confirm
- ✅ `src/functions/auth/authorizer.ts` - JWT verification
- ✅ `src/functions/user/userInfo.ts` - User information
- ✅ `src/functions/upload/upload.ts` - Upload URL generation
- ✅ `src/functions/candidates/candidates.ts` - Candidate CRUD

#### **6. Configuration Files**
- ✅ `tsconfig.json` - TypeScript compiler configuration
- ✅ `package.json` - Updated with TypeScript dependencies and build scripts
- ✅ `.eslintrc.json` - Updated for TypeScript linting

---

## 🔧 New Build System

### Build Scripts

```bash
# Build TypeScript to JavaScript
npm run build

# Watch mode (auto-rebuild on changes)
npm run build:watch

# Type checking only (no output)
npm run type-check

# Clean dist folder
npm run clean

# Lint TypeScript code
npm run lint

# Format code
npm run format
```

### Build Output

Compiled JavaScript files are generated in `dist/` directory:

```
dist/
├── core/
│   ├── models/
│   ├── repositories/
│   └── services/
├── functions/
│   ├── auth/
│   ├── candidates/
│   ├── upload/
│   ├── user/
│   └── vote/
└── shared/
    └── utils/
```

Each TypeScript file produces:
- `.js` - Compiled JavaScript (ES2020 modules)
- `.js.map` - Source maps for debugging
- `.d.ts` - Type declarations
- `.d.ts.map` - Declaration source maps

---

## 🎯 Type Safety Benefits

### Before (JavaScript with JSDoc)

```javascript
/**
 * @param {string} userId 
 * @param {string} candidateId 
 * @returns {Promise<{success: boolean, message: string}>}
 */
async processVote(userId, candidateId) {
  // ...
}
```

### After (TypeScript)

```typescript
async processVote(userId: string, candidateId: string): Promise<VoteProcessResult> {
  // TypeScript catches type errors at compile time!
}
```

### Type Errors Caught at Compile Time

```typescript
// ❌ Compile error: Argument of type 'number' is not assignable to parameter of type 'string'
await voteService.processVote(123, "C001");

// ✅ Correct usage
await voteService.processVote("U001", "C001");
```

---

## 📝 Key Type Definitions

### Core Interfaces

```typescript
// Candidate with votes
interface Candidate {
  CandidateId: string;
  name: string;
  description: string;
  imageUrl: string;
  votes: number;
}

// Vote result (with sharding support)
interface VoteResult {
  CandidateId: string;
  votes: number;
  baseCandidateId?: string;
}

// Lambda event types
interface APIGatewayProxyEvent {
  body: string | null;
  headers: Record<string, string>;
  httpMethod: string;
  path: string;
  pathParameters: Record<string, string> | null;
  requestContext: { ... };
}

interface SQSEvent {
  Records: SQSRecord[];
}
```

---

## 🚀 Deployment Changes

### **Important:** Terraform Handler Paths

Lambda handler paths **DO NOT NEED TO CHANGE** because compiled .js files maintain the same structure:

**Before (TypeScript source):**
```
src/functions/vote/voteWorker.ts
```

**After (Compiled JavaScript):**
```
dist/functions/vote/voteWorker.js
```

### Terraform Configuration

**Update `terraform/main.tf`** to use the `dist/` folder:

```hcl
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../dist"  # ← Changed from src/ to dist/
  output_path = "${path.module}/payload.zip"
}

resource "aws_lambda_function" "vote_worker" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "VoteWorker"
  role             = aws_iam_role.lambda_role.arn
  handler          = "functions/vote/voteWorker.handler"  # ← Same path!
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 10
}
```

### Deployment Workflow

```bash
# 1. Build TypeScript
npm run build

# 2. Deploy with Terraform
cd terraform
terraform apply

# Or use npm script (automatically builds first)
npm run deploy
```

---

## 🔍 No Business Logic Changes

**Critical:** All business logic remains **100% identical** to the original JavaScript version:

### ✅ Preserved Features

- **Write sharding** for DynamoDB votes (10 shards)
- **In-memory caching** for candidates (5-second TTL)
- **Duplicate vote detection** via DynamoDB transactions
- **Error handling** with custom error classes
- **Cognito authentication** (login, signup, confirm)
- **S3 pre-signed URLs** for uploads
- **CloudFront caching** support

### Type-Only Changes

```typescript
// OLD (JavaScript)
export const voteRepository = new VoteRepository();

// NEW (TypeScript) - Same runtime behavior!
export const voteRepository = new VoteRepository();
```

The compiled JavaScript is **functionally equivalent** to the original .mjs files.

---

## 📦 Dependencies Added

```json
{
  "devDependencies": {
    "@types/aws-lambda": "^8.10.138",      // Lambda type definitions
    "@types/node": "^20.12.12",             // Node.js type definitions
    "@typescript-eslint/eslint-plugin": "^7.10.0",  // TypeScript linting
    "@typescript-eslint/parser": "^7.10.0",         // TypeScript parser
    "rimraf": "^5.0.7",                     // Cross-platform clean command
    "typescript": "^5.4.5"                  // TypeScript compiler
  }
}
```

Total size: **~50MB** (includes TypeScript compiler, type definitions, linters)

---

## 🧪 Testing

### Type Checking

```bash
# Check for type errors without building
npm run type-check
```

### Expected Output

```
> voting-system@1.0.0 type-check
> tsc --noEmit

# No errors = success! ✅
```

### Linting

```bash
npm run lint
```

---

## 🔄 Old Files (.mjs) Status

**Old JavaScript files are still present** in `src/` directory:

```
src/
├── core/
│   ├── models/types.mjs          # ← Old
│   └── models/types.ts           # ← New
├── shared/utils/constants.mjs    # ← Old
├── shared/utils/constants.ts     # ← New
...
```

### ⚠️ **Action Required After Successful Deployment**

1. **Test deployment first:**
   ```bash
   npm run deploy
   # Run k6 load tests to verify
   k6 run k6-load-test.js
   ```

2. **After confirming everything works:**
   ```bash
   # Delete old .mjs files
   Remove-Item -Recurse -Force src/**/*.mjs
   ```

---

## 📚 IDE Support

### VS Code Extensions (Recommended)

- **ESLint** - TypeScript linting
- **Prettier** - Code formatting
- **TypeScript and JavaScript Language Features** (built-in)

### IntelliSense

TypeScript provides **autocomplete** and **inline documentation**:

```typescript
voteService.  // ← Press Ctrl+Space
  // Autocomplete suggestions:
  // - processVote(userId: string, candidateId: string)
  // - processBatchVotes(records: SQSRecord[])
```

---

## 🐛 Common Issues

### Issue 1: "Cannot find module" errors

**Solution:** Run `npm install` to install all dependencies.

### Issue 2: Build fails with "tsc: command not found"

**Solution:** Make sure TypeScript is installed:
```bash
npm install -D typescript
```

### Issue 3: Lambda functions return 502 errors after deployment

**Cause:** Forgot to build before deploying

**Solution:**
```bash
npm run build
cd terraform
terraform apply
```

### Issue 4: Import path errors (.js vs .ts)

**Note:** TypeScript source files use `.js` extensions in imports:

```typescript
// ✅ Correct
import { voteService } from "../../core/services/VoteService.js";

// ❌ Wrong
import { voteService } from "../../core/services/VoteService.ts";
```

This is intentional - TypeScript compiler resolves `.ts` files but emits `.js` imports for runtime.

---

## 📊 Comparison: Before vs After

| Aspect | JavaScript (.mjs) | TypeScript (.ts) |
|--------|-------------------|------------------|
| Type safety | JSDoc comments (optional) | Compile-time type checking |
| IDE support | Limited autocomplete | Full IntelliSense |
| Refactoring | Manual, error-prone | Safe, automated |
| Documentation | Inline comments | Types are documentation |
| Build step | None | Required (`npm run build`) |
| Runtime performance | Same | Same (compiles to JS) |
| Error detection | Runtime only | Compile-time + runtime |
| File size | Smaller (.mjs only) | Larger (+ .d.ts, .map files) |

---

## 🎯 Next Steps

1. ✅ **Build successful** - TypeScript compilation completed
2. ⏳ **Update Terraform** - Change `source_dir` from `src/` to `dist/`
3. ⏳ **Deploy to AWS** - `npm run deploy`
4. ⏳ **Run load tests** - Verify 10,000 RPS with 0% errors
5. ⏳ **Delete old .mjs files** - After confirming deployment works

---

## 🚀 Production Checklist

Before deploying TypeScript version to production:

- [ ] `npm run build` completes without errors
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes (or fix warnings)
- [ ] Terraform configuration updated to use `dist/` folder
- [ ] Tested locally with sample events
- [ ] Deployed to staging environment first
- [ ] Load tested with k6 (10,000 RPS target)
- [ ] Monitored CloudWatch logs for errors
- [ ] Verified DynamoDB vote sharding works correctly
- [ ] Confirmed candidate caching still functions

---

## 📞 Support

Nếu gặp vấn đề với TypeScript migration:

1. Check build errors: `npm run build`
2. Check type errors: `npm run type-check`
3. Check generated files: `ls dist/`
4. Compare `.mjs` vs compiled `.js` logic

**Logic nghiệp vụ KHÔNG thay đổi** - chỉ có type annotations được thêm vào!
