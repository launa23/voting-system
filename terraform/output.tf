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