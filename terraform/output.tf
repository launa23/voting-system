# outputs.tf

output "api_endpoint" {
  value = aws_apigatewayv2_api.api.api_endpoint
  description = "API Gateway endpoint URL"
}

output "user_pool_id" {
  value = aws_cognito_user_pool.pool.id
  description = "Cognito User Pool ID"
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.client.id
  description = "Cognito User Pool Client ID"
}

output "cognito_region" {
  value = "ap-southeast-1"
  description = "AWS Region for Cognito"
}
# CloudFront Outputs (if deployed)
output "cloudfront_domain" {
  value       = try(aws_cloudfront_distribution.candidates_cache.domain_name, "Not deployed")
  description = "CloudFront domain for candidates cache"
}

output "cloudfront_url" {
  value       = try("https://${aws_cloudfront_distribution.candidates_cache.domain_name}/candidates.json", "Not deployed")
  description = "Full URL to get candidates from CloudFront"
}

output "s3_cache_bucket" {
  value       = try(aws_s3_bucket.candidates_cache.id, "Not deployed")
  description = "S3 bucket for candidates cache"
}

# DLQ Monitoring Outputs
output "dlq_alarm_topic_arn" {
  value       = aws_sns_topic.dlq_alarm.arn
  description = "SNS Topic ARN for DLQ alerts - subscribe email here"
}

output "dlq_queue_url" {
  value       = aws_sqs_queue.vote_dlq.url
  description = "DLQ URL - check failed messages here"
}

output "cloudwatch_dashboard_url" {
  value       = "https://ap-southeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-southeast-1#dashboards:name=${aws_cloudwatch_dashboard.voting_dashboard.dashboard_name}"
  description = "CloudWatch Dashboard URL - includes DLQ monitoring"
}
