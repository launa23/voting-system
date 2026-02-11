// lambda/update-candidates-cache.mjs
// Lambda để update S3 cache mỗi 5 giây
// Trigger: EventBridge schedule

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const CANDIDATES_TABLE = "Candidates";
const VOTE_RESULTS_TABLE = "VoteResults";
const S3_BUCKET = process.env.CACHE_BUCKET;
const S3_KEY = "candidates.json";

export const handler = async (event) => {
  try {
    console.log('🔄 Updating candidates cache in S3...');
    const startTime = Date.now();
    
    // Lấy danh sách ứng viên
    const candidatesResult = await docClient.send(new ScanCommand({
      TableName: CANDIDATES_TABLE
    }));
    
    // Lấy kết quả vote
    const voteResult = await docClient.send(new ScanCommand({
      TableName: VOTE_RESULTS_TABLE
    }));
    
    // Tạo map votes
    const votesMap = {};
    (voteResult.Items || []).forEach(item => {
      votesMap[item.CandidateId] = item.votes || 0;
    });
    
    // Gắn số votes vào từng ứng viên
    const candidates = (candidatesResult.Items || []).map(candidate => ({
      ...candidate,
      votes: votesMap[candidate.CandidateId] || 0
    }));
    
    // Upload lên S3
    const body = JSON.stringify({
      candidates,
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now()
    });
    
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_KEY,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=5', // Browser cache 5s
    }));
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Cache updated successfully in ${duration}ms`);
    console.log(`   Candidates: ${candidates.length}`);
    console.log(`   Total votes: ${Object.values(votesMap).reduce((a, b) => a + b, 0)}`);
    console.log(`   S3 location: s3://${S3_BUCKET}/${S3_KEY}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        candidatesCount: candidates.length,
        timestamp: new Date().toISOString(),
        duration
      })
    };
    
  } catch (error) {
    console.error('❌ Error updating cache:', error);
    throw error;
  }
};
