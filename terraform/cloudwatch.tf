# ==============================================================================
# 7. CLOUDWATCH DASHBOARD (MONITORING)
# ==============================================================================

# SNS Topic cho DLQ Alerts
resource "aws_sns_topic" "dlq_alarm" {
  name         = "vote-dlq-alarm"
  display_name = "Vote DLQ Alert"
}

# CloudWatch Alarm - Warning: DLQ có >= 1 message
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "vote-dlq-has-messages"
  alarm_description   = "Alert when DLQ receives failed messages"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  
  dimensions = {
    QueueName = aws_sqs_queue.vote_dlq.name
  }
  
  alarm_actions = [aws_sns_topic.dlq_alarm.arn]
  ok_actions    = [aws_sns_topic.dlq_alarm.arn]
}

# CloudWatch Alarm - Critical: DLQ có >= 100 messages
resource "aws_cloudwatch_metric_alarm" "dlq_messages_critical" {
  alarm_name          = "vote-dlq-critical"
  alarm_description   = "Critical: DLQ has many failed messages"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 100
  treat_missing_data  = "notBreaching"
  
  dimensions = {
    QueueName = aws_sqs_queue.vote_dlq.name
  }
  
  alarm_actions = [aws_sns_topic.dlq_alarm.arn]
}

# Email subscription - Uncomment và thay email để nhận alert
# resource "aws_sns_topic_subscription" "dlq_alarm_email" {
#   topic_arn = aws_sns_topic.dlq_alarm.arn
#   protocol  = "email"
#   endpoint  = "your-email@example.com"
# }

resource "aws_cloudwatch_dashboard" "voting_dashboard" {
  dashboard_name = "Voting-System-Monitor"

  dashboard_body = jsonencode({
    widgets = [
      # HÀNG 1: TRAFFIC & LATENCY (API GATEWAY)
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", aws_apigatewayv2_api.api.id, { stat = "Sum", period = 60, label = "Requests/Min" }],
            [".", "5xx", ".", ".", { stat = "Sum", period = 60, label = "5xx Errors", color = "#d62728" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "ap-southeast-1"
          title   = "API Traffic & Errors"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiId", aws_apigatewayv2_api.api.id, { stat = "p95", period = 60, label = "P95 Latency (ms)" }]
          ]
          view    = "timeSeries"
          region  = "ap-southeast-1"
          title   = "API Latency (P95)"
        }
      },

      # HÀNG 2: SQS BACKLOG & LAMBDA SCALING
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.vote_queue.name, { stat = "Maximum", period = 10, label = "Backlog Messages", color = "#ff7f0e" }]
          ]
          view    = "timeSeries"
          region  = "ap-southeast-1"
          title   = "SQS Queue Depth (Ùn ứ)"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", aws_lambda_function.vote_worker.function_name, { stat = "Maximum", period = 10, label = "Concurrent Workers" }],
            [".", "Throttles", ".", ".", { stat = "Sum", period = 60, label = "Throttles", color = "#d62728" }]
          ]
          view    = "timeSeries"
          region  = "ap-southeast-1"
          title   = "Lambda Scaling"
        }
      },

      # HÀNG 3: DYNAMODB PERFORMANCE
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.vote_results.name, { stat = "Sum", period = 60, label = "VoteResults WCU" }],
            [".", "WriteThrottleEvents", ".", ".", { stat = "Sum", period = 60, label = "Throttled Events (Lỗi Nghẽn)", color = "#d62728", yAxis = "right" }]
          ]
          view    = "timeSeries"
          region  = "ap-southeast-1"
          title   = "DynamoDB Capacity & Throttling"
        }
      },

      # HÀNG 4: DLQ MONITORING (DEAD LETTER QUEUE)
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.vote_dlq.name, { stat = "Maximum", period = 60, label = "Messages in DLQ", color = "#d62728" }],
            [".", "ApproximateAgeOfOldestMessage", ".", ".", { stat = "Maximum", period = 60, label = "Oldest Message Age (s)", yAxis = "right" }]
          ]
          view    = "timeSeries"
          region  = "ap-southeast-1"
          title   = "Dead Letter Queue (Failed Messages)"
          annotations = {
            horizontal = [
              {
                label = "Warning Threshold"
                value = 1
                color = "#ff7f0e"
              }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "NumberOfMessagesSent", "QueueName", aws_sqs_queue.vote_queue.name, { stat = "Sum", period = 60, label = "Main Queue - Sent" }],
            [".", "NumberOfMessagesReceived", ".", ".", { stat = "Sum", period = 60, label = "Main Queue - Received" }],
            [".", "NumberOfMessagesDeleted", ".", ".", { stat = "Sum", period = 60, label = "Main Queue - Deleted" }]
          ]
          view    = "timeSeries"
          region  = "ap-southeast-1"
          title   = "Main Queue Activity"
        }
      }
    ]
  })
}