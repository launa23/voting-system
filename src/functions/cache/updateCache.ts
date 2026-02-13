/**
 * Update Candidates Cache Lambda
 * Scheduled task to update S3 cache every 1 minute
 * Triggered by EventBridge
 * 
 * THIS IS A THIN HANDLER - Uses Service layer
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { candidateService } from "../../core/services/CandidateService.js";

const s3Client = new S3Client({});

const S3_BUCKET = process.env.CACHE_BUCKET || '';
const S3_KEY = "candidates.json";

interface ScheduledEvent {
  version: string;
  id: string;
  'detail-type': string;
  source: string;
  time: string;
}

export const handler = async (_event: ScheduledEvent) => {
  try {
    console.log('🔄 Updating candidates cache in S3...');
    const startTime = Date.now();
    
    // Get all candidates with aggregated vote counts
    const candidates = await candidateService.getAllCandidates(false);
    
    // Prepare cache data
    const body = JSON.stringify({
      candidates,
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now()
    });
    
    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_KEY,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=5', // Browser cache 5s
    }));
    
    const duration = Date.now() - startTime;
    const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
    
    console.log(`✅ Cache updated successfully in ${duration}ms`);
    console.log(`   Candidates: ${candidates.length}`);
    console.log(`   Total votes: ${totalVotes}`);
    console.log(`   S3 location: s3://${S3_BUCKET}/${S3_KEY}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        candidatesCount: candidates.length,
        totalVotes,
        timestamp: new Date().toISOString(),
        duration
      })
    };
    
  } catch (error) {
    console.error('❌ Error updating cache:', error);
    throw error;
  }
};
