# main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    archive = {
      source = "hashicorp/archive"
    }
  }
}

provider "aws" {
  region = "ap-southeast-1" # Singapore
}

# ==============================================================================
# 1. DYNAMODB TABLES
# ==============================================================================
resource "aws_dynamodb_table" "vote_results" {
  name           = "VoteResults"
  # billing_mode   = "PAY_PER_REQUEST"
  read_capacity  = 10
  write_capacity = 10000 # Tăng lên 2000-5000 khi bắt đầu Stress Test
  hash_key       = "CandidateId"

  attribute {
    name = "CandidateId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "user_vote_history" {
  name           = "UserVoteHistory"
  # billing_mode   = "PAY_PER_REQUEST"
  read_capacity  = 10
  write_capacity = 10000 # Tăng lên 2000-5000 khi bắt đầu Stress Test
  hash_key       = "UserId"

  attribute {
    name = "UserId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "candidates" {
  name           = "Candidates"
  billing_mode   = "PAY_PER_REQUEST" # On-demand cho table ít traffic
  hash_key       = "CandidateId"

  attribute {
    name = "CandidateId"
    type = "S"
  }
}

# ==============================================================================
# 2. S3 BUCKET FOR CANDIDATE IMAGES
# ==============================================================================
resource "aws_s3_bucket" "candidate_images" {
  bucket = "voting-system-candidate-images-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "candidate_images" {
  bucket = aws_s3_bucket.candidate_images.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "candidate_images" {
  bucket = aws_s3_bucket.candidate_images.id
  depends_on = [aws_s3_bucket_public_access_block.candidate_images]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.candidate_images.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_cors_configuration" "candidate_images" {
  bucket = aws_s3_bucket.candidate_images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Data source để lấy account ID
data "aws_caller_identity" "current" {}

# ==============================================================================
# 3. SQS QUEUE
# ==============================================================================
# Dead Letter Queue - lưu message thất bại
resource "aws_sqs_queue" "vote_dlq" {
  name                      = "vote-dlq"
  message_retention_seconds = 1209600 # 14 ngày
  visibility_timeout_seconds = 30
}

# Main Queue với DLQ
resource "aws_sqs_queue" "vote_queue" {
  name                      = "vote-queue"
  message_retention_seconds = 3600 # 1 giờ (cho sạch)
  visibility_timeout_seconds = 30
  
  # Sau 10 lần thất bại -> chuyển sang DLQ
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.vote_dlq.arn
    maxReceiveCount     = 10
  })
}

# ==============================================================================
# 3. LAMBDA WORKER & IAM ROLE
# ==============================================================================
# Role cho Lambda
resource "aws_iam_role" "lambda_role" {
  name = "vote_worker_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Gán quyền Full cho Lambda (Test only - Prod nên giới hạn chặt hơn)
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
resource "aws_iam_role_policy_attachment" "lambda_sqs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
}
resource "aws_iam_role_policy_attachment" "lambda_dynamo" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

# Add Cognito permissions for Lambda functions
resource "aws_iam_role_policy_attachment" "lambda_cognito" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonCognitoPowerUser"
}

# Zip code Node.js
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/index.mjs"
  output_path = "${path.module}/payload.zip"
}

# Tạo hàm Lambda
resource "aws_lambda_function" "vote_worker" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "VoteWorker"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 10
}

# Trigger: SQS -> Lambda (Batch Size 100)
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.vote_queue.arn
  function_name    = aws_lambda_function.vote_worker.arn
  batch_size       = 100
  maximum_batching_window_in_seconds = 1
  
  # Enable partial batch failure - chỉ retry message thất bại
  function_response_types = ["ReportBatchItemFailures"]
}

# ==============================================================================
# 4. COGNITO (AUTHENTICATION)
# ==============================================================================
resource "aws_cognito_user_pool" "pool" {
  name = "vote-user-pool"
  
  # Cho phép user tự đăng ký (không cần xác thực email)
  username_attributes = ["email"]
  
  password_policy {
    minimum_length    = 6
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }
  
  # Schema cho user attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required           = true
    mutable            = true
  }
}

resource "aws_cognito_user_pool_client" "client" {
  name         = "vote-app-client"
  user_pool_id = aws_cognito_user_pool.pool.id
  
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH", 
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
  
  # Không cần client secret cho public apps (web/mobile)
  generate_secret = false
  
  # Token validity
  id_token_validity     = 60
  access_token_validity = 60
  refresh_token_validity = 30
  
  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }
}

# ==============================================================================
# 5. LAMBDA AUTHORIZER (COGNITO JWT VALIDATOR)
# ==============================================================================

# Zip code Auth (Cognito JWT Validator)
data "archive_file" "auth_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/auth.mjs"
  output_path = "${path.module}/auth.zip"
}

# Tạo hàm Lambda Auth
resource "aws_lambda_function" "auth_func" {
  filename         = data.archive_file.auth_zip.output_path
  function_name    = "CognitoJWTAuth"
  role             = aws_iam_role.lambda_role.arn
  handler          = "auth.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.auth_zip.output_base64sha256
  
  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.pool.id
      COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.client.id
    }
  }
}

# Cấp quyền cho API Gateway được gọi Lambda Auth này
resource "aws_lambda_permission" "api_gw_invoke_auth" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_func.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# ==============================================================================
# 6. LAMBDA LOGIN MANAGER (AUTHENTICATION)
# ==============================================================================

# Zip code Login
data "archive_file" "login_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/login.mjs"
  output_path = "${path.module}/login.zip"
}

# Tạo hàm Lambda Login
resource "aws_lambda_function" "login_func" {
  filename         = data.archive_file.login_zip.output_path
  function_name    = "AuthenticationManager"
  role             = aws_iam_role.lambda_role.arn
  handler          = "login.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.login_zip.output_base64sha256
  timeout          = 10
  
  environment {
    variables = {
      COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.client.id
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.pool.id
    }
  }
}

# Cấp quyền cho API Gateway gọi Lambda Login
resource "aws_lambda_permission" "api_gw_invoke_login" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.login_func.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# ==============================================================================
# 7. LAMBDA USER INFO MANAGER
# ==============================================================================

# Zip code User Info
data "archive_file" "user_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/user.mjs"
  output_path = "${path.module}/user.zip"
}

# Tạo hàm Lambda User Info
resource "aws_lambda_function" "user_func" {
  filename         = data.archive_file.user_zip.output_path
  function_name    = "UserInfoManager"
  role             = aws_iam_role.lambda_role.arn
  handler          = "user.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.user_zip.output_base64sha256
  timeout          = 10
}

# Cấp quyền cho API Gateway gọi Lambda User Info
resource "aws_lambda_permission" "api_gw_invoke_user" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_func.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# ==============================================================================
# 8. LAMBDA CANDIDATES MANAGER
# ==============================================================================

# Zip code Candidates
data "archive_file" "candidates_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/candidates.mjs"
  output_path = "${path.module}/candidates.zip"
}

# Tạo hàm Lambda Candidates
resource "aws_lambda_function" "candidates_func" {
  filename         = data.archive_file.candidates_zip.output_path
  function_name    = "CandidatesManager"
  role             = aws_iam_role.lambda_role.arn
  handler          = "candidates.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.candidates_zip.output_base64sha256
  timeout          = 10
}

# Cấp quyền cho API Gateway gọi Lambda Candidates
resource "aws_lambda_permission" "api_gw_invoke_candidates" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.candidates_func.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# ==============================================================================
# 9. LAMBDA UPLOAD MANAGER
# ==============================================================================

# Zip code Upload
data "archive_file" "upload_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/upload.mjs"
  output_path = "${path.module}/upload.zip"
}

# Tạo hàm Lambda Upload
resource "aws_lambda_function" "upload_func" {
  filename         = data.archive_file.upload_zip.output_path
  function_name    = "UploadManager"
  role             = aws_iam_role.lambda_role.arn
  handler          = "upload.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.upload_zip.output_base64sha256
  timeout          = 10
  
  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.candidate_images.id
    }
  }
}

# Cấp quyền cho API Gateway gọi Lambda Upload
resource "aws_lambda_permission" "api_gw_invoke_upload" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload_func.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# ==============================================================================
# 10. API GATEWAY HTTP API (INTEGRATION)
# ==============================================================================
# Tạo API
resource "aws_apigatewayv2_api" "api" {
  name          = "vote-http-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 300
  }
}

# Role cho API Gateway quyền ghi vào SQS
resource "aws_iam_role" "apigw_sqs_role" {
  name = "api_gateway_sqs_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "apigateway.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "apigw_sqs_policy" {
  name = "apigw_sqs_policy"
  role = aws_iam_role.apigw_sqs_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "sqs:SendMessage"
      Resource = aws_sqs_queue.vote_queue.arn
    }]
  })
}

# Integration: API Gateway -> SQS
resource "aws_apigatewayv2_integration" "sqs_integration" {
  api_id              = aws_apigatewayv2_api.api.id
  integration_type    = "AWS_PROXY"
  integration_subtype = "SQS-SendMessage"
  credentials_arn     = aws_iam_role.apigw_sqs_role.arn

  # Mapping tham số (Quan trọng)
  request_parameters = {
    "QueueUrl"    = aws_sqs_queue.vote_queue.url
    "MessageBody" = "$request.body"
  }
}

# Authorizer: JWT từ Cognito
resource "aws_apigatewayv2_authorizer" "auth" {
  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"
  
  # Disable cache for JWT authorizer (required for HTTP API)
  authorizer_result_ttl_in_seconds = 0

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client.id]
    issuer   = "https://cognito-idp.ap-southeast-1.amazonaws.com/${aws_cognito_user_pool.pool.id}"
  }
}

# Route: POST /vote (Cần JWT token từ Cognito)
resource "aws_apigatewayv2_route" "vote_route" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "POST /vote"
  target             = "integrations/${aws_apigatewayv2_integration.sqs_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.auth.id
}

# Stage: Auto Deploy
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# ==============================================================================
# 10. AUTHENTICATION API ROUTES
# ==============================================================================

# Integration: API Gateway -> Lambda Login
resource "aws_apigatewayv2_integration" "login_integration" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.login_func.invoke_arn
  payload_format_version = "2.0"
}

# Route: POST /login (Login - không cần auth)
resource "aws_apigatewayv2_route" "login" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /login"
  target    = "integrations/${aws_apigatewayv2_integration.login_integration.id}"
}

# Route: POST /signup (Sign up - không cần auth)
resource "aws_apigatewayv2_route" "signup" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /signup"
  target    = "integrations/${aws_apigatewayv2_integration.login_integration.id}"
}

# Route: POST /confirm (Email confirmation - không cần auth)
resource "aws_apigatewayv2_route" "confirm" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /confirm"
  target    = "integrations/${aws_apigatewayv2_integration.login_integration.id}"
}

# Integration: API Gateway -> Lambda User Info
resource "aws_apigatewayv2_integration" "user_integration" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.user_func.invoke_arn
  payload_format_version = "2.0"
}

# Route: GET /user/me (Get current user info - cần auth)
resource "aws_apigatewayv2_route" "get_user_me" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "GET /user/me"
  target             = "integrations/${aws_apigatewayv2_integration.user_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.auth.id
}

# ==============================================================================
# 12. UPLOAD API ROUTES
# ==============================================================================

# Integration: API Gateway -> Lambda Upload
resource "aws_apigatewayv2_integration" "upload_integration" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.upload_func.invoke_arn
  payload_format_version = "2.0"
}

# Route: POST /upload-url (Lấy pre-signed URL - cần auth)
resource "aws_apigatewayv2_route" "upload_url" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "POST /upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.upload_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.auth.id
}

# ==============================================================================
# 13. CANDIDATES API ROUTES
# ==============================================================================

# Integration: API Gateway -> Lambda Candidates
resource "aws_apigatewayv2_integration" "candidates_integration" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.candidates_func.invoke_arn
  payload_format_version = "2.0"
}

# Route: GET /candidates (Lấy danh sách - không cần auth)
resource "aws_apigatewayv2_route" "get_candidates" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /candidates"
  target    = "integrations/${aws_apigatewayv2_integration.candidates_integration.id}"
}

# Route: GET /candidates/{id} (Lấy chi tiết - không cần auth)
resource "aws_apigatewayv2_route" "get_candidate" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /candidates/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.candidates_integration.id}"
}

# Route: POST /candidates (Tạo mới - cần auth)
resource "aws_apigatewayv2_route" "create_candidate" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "POST /candidates"
  target             = "integrations/${aws_apigatewayv2_integration.candidates_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.auth.id
}

# Route: PUT /candidates/{id} (Cập nhật - cần auth)
resource "aws_apigatewayv2_route" "update_candidate" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "PUT /candidates/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.candidates_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.auth.id
}

# Route: DELETE /candidates/{id} (Xóa - cần auth)
resource "aws_apigatewayv2_route" "delete_candidate" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "DELETE /candidates/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.candidates_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.auth.id
}