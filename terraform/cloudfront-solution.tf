# ==============================================================================
# CLOUDFRONT + S3 CACHE SOLUTION
# Update candidates list every 5 seconds via EventBridge
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. S3 Bucket cho Cache
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "candidates_cache" {
  bucket = "voting-system-candidates-cache-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "candidates_cache" {
  bucket = aws_s3_bucket.candidates_cache.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_cors_configuration" "candidates_cache" {
  bucket = aws_s3_bucket.candidates_cache.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ------------------------------------------------------------------------------
# 2. CloudFront Distribution
# ------------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_identity" "candidates_cache" {
  comment = "OAI for candidates cache"
}

resource "aws_s3_bucket_policy" "candidates_cache" {
  bucket = aws_s3_bucket.candidates_cache.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.candidates_cache.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.candidates_cache.arn}/*"
      }
    ]
  })
}

resource "aws_cloudfront_distribution" "candidates_cache" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN for voting system candidates"
  default_root_object = "candidates.json"
  price_class         = "PriceClass_100" # US, Europe, Israel (cheapest)

  origin {
    domain_name = aws_s3_bucket.candidates_cache.bucket_regional_domain_name
    origin_id   = "S3-candidates-cache"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.candidates_cache.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-candidates-cache"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 5      # Cache 5 seconds
    max_ttl                = 30     # Max 30 seconds
    compress               = true   # Gzip compression
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# ------------------------------------------------------------------------------
# 3. Lambda để update S3 cache
# ------------------------------------------------------------------------------

# Tạo zip file cho Lambda function
data "archive_file" "update_cache_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/update-candidates-cache.mjs"
  output_path = "${path.module}/update-cache.zip"
}

resource "aws_lambda_function" "update_cache" {
  filename         = data.archive_file.update_cache_zip.output_path
  function_name    = "UpdateCandidatesCache"
  role            = aws_iam_role.lambda_role.arn
  handler         = "update-candidates-cache.handler"
  runtime         = "nodejs20.x"
  timeout         = 60
  memory_size     = 512
  source_code_hash = data.archive_file.update_cache_zip.output_base64sha256

  environment {
    variables = {
      CACHE_BUCKET = aws_s3_bucket.candidates_cache.id
    }
  }

  depends_on = [aws_iam_role_policy.lambda_s3_write]
}

# Permission để Lambda write vào S3
resource "aws_iam_role_policy" "lambda_s3_write" {
  name = "lambda-s3-write"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.candidates_cache.arn}/*"
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 4. EventBridge Schedule - Update cache mỗi 1 phút
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "update_cache_schedule" {
  name                = "update-candidates-cache"
  description         = "Update candidates cache every 1 minute"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "update_cache" {
  rule      = aws_cloudwatch_event_rule.update_cache_schedule.name
  target_id = "UpdateCacheLambda"
  arn       = aws_lambda_function.update_cache.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_cache.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.update_cache_schedule.arn
}
