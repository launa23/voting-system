// lambda/index.mjs
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  const batchItemFailures = [];
  
  // Xử lý từng message riêng lẻ
  const promises = event.Records.map(async (record) => {
    try {
      // SQS Body là chuỗi JSON, cần parse
      const body = JSON.parse(record.body);
      const { userId, candidateId } = body;

      if (!userId || !candidateId) {
        console.warn('Invalid message, missing userId or candidateId:', record.messageId);
        return; // Bỏ qua tin rác (không retry)
      }

      const params = {
        TransactItems: [
          {
            // 1. Kiểm tra & Lưu lịch sử (Chống gian lận)
            Put: {
              TableName: "UserVoteHistory",
              Item: { UserId: userId },
              ConditionExpression: "attribute_not_exists(UserId)"
            }
          },
          {
            // 2. Cộng điểm
            Update: {
              TableName: "VoteResults",
              Key: { CandidateId: candidateId },
              UpdateExpression: "ADD votes :inc",
              ExpressionAttributeValues: { ":inc": 1 }
            }
          }
        ]
      };

      await docClient.send(new TransactWriteCommand(params));
      console.log(`Successfully processed vote: ${userId} -> ${candidateId}`);

    } catch (err) {
      if (err.name === 'TransactionCanceledException') {
        // User đã vote rồi -> Lặng lẽ bỏ qua (không retry)
        console.log(`Duplicate vote ignored for user: ${JSON.parse(record.body).userId}`);
      } else {
        // Lỗi hệ thống thực sự -> Đánh dấu để retry
        console.error("System Error for message:", record.messageId, err);
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
  });

  await Promise.all(promises);
  
  // Trả về danh sách message IDs bị lỗi để SQS retry
  return { batchItemFailures };
};