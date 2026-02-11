# Migration Instructions - Old Structure → New Structure

## 📋 Checklist

- [ ] 1. Backup hiện tại
- [ ] 2. Install dependencies
- [ ] 3. Update Terraform configuration
- [ ] 4. Test locally (optional)
- [ ] 5. Deploy to AWS
- [ ] 6. Verify deployment
- [ ] 7. Remove old lambda/ folder

---

## Step 1: Backup Current Setup

```bash
# Backup terraform state
cp terraform/terraform.tfstate terraform/terraform.tfstate.backup.$(date +%Y%m%d)

# Backup old lambda folder
cp -r lambda lambda.backup.$(date +%Y%m%d)
```

---

## Step 2: Install Dependencies

```bash
# Tại thư mục gốc voting-system/
npm install
```

---

## Step 3: Update Terraform Configuration

### File: `terraform/main.tf`

Tìm và thay thế các đoạn sau:

#### A. Vote Worker Lambda

**OLD:**
```hcl
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/index.mjs"
  output_path = "${path.module}/payload.zip"
}

resource "aws_lambda_function" "vote_worker" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "VoteWorker"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 10
}
```

**NEW:**
```hcl
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../src"
  output_path = "${path.module}/payload.zip"
}

resource "aws_lambda_function" "vote_worker" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "VoteWorker"
  role             = aws_iam_role.lambda_role.arn
  handler          = "functions/vote/voteWorker.handler"  # ← Changed
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 10
}
```

#### B. Auth Authorizer

**OLD:**
```hcl
data "archive_file" "auth_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/auth.mjs"
  output_path = "${path.module}/auth.zip"
}

resource "aws_lambda_function" "auth_func" {
  filename         = data.archive_file.auth_zip.output_path
  handler          = "auth.handler"
  ...
}
```

**NEW:**
```hcl
# Dùng chung source_dir với các Lambda khác
resource "aws_lambda_function" "auth_func" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "CognitoJWTAuth"
  role             = aws_iam_role.lambda_role.arn
  handler          = "functions/auth/authorizer.handler"  # ← Changed
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  ...
}
```

#### C. Login/Authentication

**OLD:**
```hcl
data "archive_file" "login_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/login.mjs"
  output_path = "${path.module}/login.zip"
}

resource "aws_lambda_function" "login_func" {
  filename         = data.archive_file.login_zip.output_path
  handler          = "login.handler"
  ...
}
```

**NEW:**
```hcl
resource "aws_lambda_function" "login_func" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "AuthenticationManager"
  role             = aws_iam_role.lambda_role.arn
  handler          = "functions/auth/authentication.handler"  # ← Changed
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  ...
}
```

#### D. User Info

**OLD:**
```hcl
data "archive_file" "user_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/user.mjs"
  output_path = "${path.module}/user.zip"
}

resource "aws_lambda_function" "user_func" {
  filename         = data.archive_file.user_zip.output_path
  handler          = "user.handler"
  ...
}
```

**NEW:**
```hcl
resource "aws_lambda_function" "user_func" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "UserInfoManager"
  role             = aws_iam_role.lambda_role.arn
  handler          = "functions/user/userInfo.handler"  # ← Changed
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  ...
}
```

#### E. Candidates

**OLD:**
```hcl
data "archive_file" "candidates_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/candidates.mjs"
  output_path = "${path.module}/candidates.zip"
}

resource "aws_lambda_function" "candidates_func" {
  filename         = data.archive_file.candidates_zip.output_path
  handler          = "candidates.handler"
  ...
}
```

**NEW:**
```hcl
resource "aws_lambda_function" "candidates_func" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "CandidatesManager"
  role             = aws_iam_role.lambda_role.arn
  handler          = "functions/candidates/candidates.handler"  # ← Changed
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  ...
}
```

#### F. Upload

**OLD:**
```hcl
data "archive_file" "upload_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/upload.mjs"
  output_path = "${path.module}/upload.zip"
}

resource "aws_lambda_function" "upload_func" {
  filename         = data.archive_file.upload_zip.output_path
  handler          = "upload.handler"
  ...
}
```

**NEW:**
```hcl
resource "aws_lambda_function" "upload_func" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "UploadManager"
  role             = aws_iam_role.lambda_role.arn
  handler          = "functions/upload/upload.handler"  # ← Changed
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_path_base64sha256
  ...
}
```

---

## Step 4: Validate Terraform

```bash
cd terraform
terraform validate
terraform plan
```

**Expected output:**
```
Plan: 0 to add, 6 to change, 0 to destroy.
```

(6 Lambda functions sẽ được update với handler path mới)

---

## Step 5: Deploy

```bash
terraform apply
```

Hoặc dùng npm script:
```bash
cd ..
npm run deploy
```

---

## Step 6: Verify Deployment

### A. Check Lambda Functions

```bash
# List all functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `Vote`) || contains(FunctionName, `Auth`) || contains(FunctionName, `User`) || contains(FunctionName, `Candidates`) || contains(FunctionName, `Upload`)].FunctionName'
```

### B. Test Endpoints

```bash
# Get API endpoint
cd terraform
terraform output

# Test candidates endpoint
curl https://<api-endpoint>/candidates

# Test login
curl -X POST https://<api-endpoint>/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### C. Check CloudWatch Logs

```bash
# View VoteWorker logs
aws logs tail /aws/lambda/VoteWorker --follow

# View Authentication logs
aws logs tail /aws/lambda/AuthenticationManager --follow
```

---

## Step 7: Cleanup (Optional)

Nếu mọi thứ hoạt động tốt, có thể xóa folder cũ:

```bash
# Remove old lambda folder (AFTER VERIFYING)
rm -rf lambda.backup.*

# Clean up old Terraform zip files
rm terraform/*.zip
```

---

## 🔧 Troubleshooting

### Issue 1: "Module not found" errors in Lambda

**Cause:** Node_modules không được include trong zip

**Fix:**
```bash
# Cài đặt dependencies trong src/ folder
cd src
npm install
cd ..

# Hoặc copy node_modules vào src/
cp -r node_modules src/
```

### Issue 2: Handler not found

**Cause:** Handler path sai

**Check:**
```bash
# Unzip and inspect
cd terraform
# unzip -l ppayload.zip | grep handler

# Should see:
# functions/vote/voteWorker.mjs
# functions/auth/authentication.mjs
# ...
```

### Issue 3: Terraform state mismatch

**Fix:**
```bash
cd terraform
terraform refresh
terraform plan
```

---

## 📊 Verification Checklist

After migration, verify:

- [ ] All Lambda functions updated successfully
- [ ] API endpoints respond correctly
- [ ] Authentication works (login/signup)
- [ ] Voting works (POST /vote)
- [ ] Candidates CRUD works
- [ ] Upload works (generate presigned URLs)
- [ ] CloudWatch logs show correct function names
- [ ] No errors in production

---

## 🎯 Benefits After Migration

✅ **Before:**
- 6 separate zip files
- Duplicate code in each Lambda
- Hard to share utilities
- No clear structure

✅ **After:**
- 1 unified source directory
- Shared utilities and services
- Clear separation of concerns
- Easier to maintain and test

---

**Need Help?**

1. Check [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for architecture details
2. Review new code in `src/` folder
3. Compare with old code in `lambda/` folder (if backed up)
