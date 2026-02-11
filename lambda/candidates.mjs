// lambda/candidates.mjs
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  GetCommand,
  PutCommand, 
  UpdateCommand,
  DeleteCommand 
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Candidates";
const VOTE_RESULTS_TABLE = "VoteResults";

// In-memory cache
let candidatesCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds (điều chỉnh theo nhu cầu)

export const handler = async (event) => {
  // Payload format 2.0: httpMethod nằm trong requestContext
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  const { pathParameters, body } = event;
  
  try {
    switch (httpMethod) {
      case "GET":
        if (pathParameters?.id) {
          return await getCandidate(pathParameters.id);
        }
        return await listCandidates();
        
      case "POST":
        return await createCandidate(JSON.parse(body));
        
      case "PUT":
        return await updateCandidate(pathParameters.id, JSON.parse(body));
        
      case "DELETE":
        return await deleteCandidate(pathParameters.id);
        
      default:
        return response(405, { error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error:", error);
    return response(500, { error: error.message });
  }
};

// Lấy danh sách tất cả ứng viên
async function listCandidates() {
  const now = Date.now();
  
  // Sử dụng cache nếu còn hợp lệ
  if (candidatesCache && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('Returning cached candidates');
    return response(200, candidatesCache);
  }
  
  console.log('Fetching fresh candidates from DynamoDB');
  
  // Lấy danh sách ứng viên
  const candidatesResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME
  }));
  
  // Lấy kết quả vote
  const voteResult = await docClient.send(new ScanCommand({
    TableName: VOTE_RESULTS_TABLE
  }));
  
  // Tạo map để tra cứu nhanh số votes
  const votesMap = {};
  (voteResult.Items || []).forEach(item => {
    votesMap[item.CandidateId] = item.votes || 0;
  });
  
  // Gắn số votes vào từng ứng viên
  const candidates = (candidatesResult.Items || []).map(candidate => ({
    ...candidate,
    votes: votesMap[candidate.CandidateId] || 0
  }));
  
  // Cập nhật cache
  candidatesCache = { candidates };
  cacheTimestamp = now;
  
  // Trả về response với Cache-Control header (5s)
  return response(200, candidatesCache, "public, max-age=5");
}

// Lấy thông tin 1 ứng viên
async function getCandidate(id) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { CandidateId: id }
  }));
  
  if (!result.Item) {
    return response(404, { error: "Candidate not found" });
  }
  
  return response(200, result.Item);
}

// Tạo ứng viên mới
async function createCandidate(data) {
  const { candidateId, name, description, imageUrl } = data;
  
  if (!candidateId || !name) {
    return response(400, { error: "candidateId and name are required" });
  }
  
  const item = {
    CandidateId: candidateId,
    Name: name,
    Description: description || "",
    ImageUrl: imageUrl || "",
    CreatedAt: new Date().toISOString()
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: "attribute_not_exists(CandidateId)" // Chống trùng
  }));
  
  return response(201, item);
}

// Cập nhật ứng viên
async function updateCandidate(id, data) {
  const { name, description, imageUrl } = data;
  
  if (!name && !description && imageUrl === undefined) {
    return response(400, { error: "name, description or imageUrl is required" });
  }
  
  let updateExpression = "SET ";
  const expressionValues = {};
  const expressionNames = {};
  
  if (name) {
    updateExpression += "#n = :name, ";
    expressionValues[":name"] = name;
    expressionNames["#n"] = "Name";
  }
  
  if (description !== undefined) {
    updateExpression += "Description = :desc, ";
    expressionValues[":desc"] = description;
  }
  
  if (imageUrl !== undefined) {
    updateExpression += "ImageUrl = :img, ";
    expressionValues[":img"] = imageUrl;
  }
  
  updateExpression += "UpdatedAt = :updatedAt";
  expressionValues[":updatedAt"] = new Date().toISOString();
  
  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { CandidateId: id },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
    ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
    ReturnValues: "ALL_NEW"
  }));
  
  return response(200, result.Attributes);
}

// Xóa ứng viên
async function deleteCandidate(id) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { CandidateId: id }
  }));
  
  return response(200, { message: "Candidate deleted successfully" });
}

// Helper tạo response
function response(statusCode, body, cacheControl = null) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };
  
  // Thêm Cache-Control header nếu được chỉ định
  if (cacheControl) {
    headers["Cache-Control"] = cacheControl;
  }
  
  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  };
}
