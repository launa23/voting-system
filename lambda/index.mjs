// lambda/index.mjs
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  const promises = event.Records.map(async (record) => {
    try {
      // SQS Body là chuỗi JSON, cần parse
      const body = JSON.parse(record.body);
      const { userId, candidateId } = body;

      if (!userId || !candidateId) return; // Bỏ qua tin rác

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

    } catch (err) {
      if (err.name === 'TransactionCanceledException') {
        // User đã vote rồi -> Lặng lẽ bỏ qua
      } else {
        console.error("System Error:", err);
        // Có thể throw err để SQS retry message này
      }
    }
  });

  await Promise.all(promises);
  return { status: "processed" };
};