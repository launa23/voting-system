/**
 * Vote Repository
 * Handles all database operations for voting
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES, SHARD_CONFIG } from "../../shared/utils/constants.mjs";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export class VoteRepository {
  /**
   * Get a random shard ID for write distribution
   * @param {string} candidateId 
   * @returns {number} Shard ID (0 to VOTE_SHARD_COUNT-1)
   */
  getShardId(candidateId) {
    // Random shard for better distribution
    return Math.floor(Math.random() * SHARD_CONFIG.VOTE_SHARD_COUNT);
  }

  /**
   * Process a vote using DynamoDB transaction with write sharding
   * @param {string} userId 
   * @param {string} candidateId 
   * @throws {Error} If transaction fails
   */
  async processVote(userId, candidateId) {
    const shardId = this.getShardId(candidateId);
    const shardedKey = `${candidateId}#SHARD_${shardId}`;

    const params = {
      TransactItems: [
        {
          // 1. Check and save vote history (prevent double voting)
          Put: {
            TableName: TABLE_NAMES.USER_VOTE_HISTORY,
            Item: { UserId: userId },
            ConditionExpression: "attribute_not_exists(UserId)"
          }
        },
        {
          // 2. Increment vote count with sharding to avoid hot partition
          Update: {
            TableName: TABLE_NAMES.VOTE_RESULTS,
            Key: { CandidateId: shardedKey },
            UpdateExpression: "ADD votes :inc SET baseCandidateId = :candidateId",
            ExpressionAttributeValues: { 
              ":inc": 1,
              ":candidateId": candidateId
            }
          }
        }
      ]
    };

    await docClient.send(new TransactWriteCommand(params));
  }

  /**
   * Get aggregated vote count for a candidate from all shards
   * @param {string} candidateId 
   * @returns {Promise<number>} Total vote count
   */
  async getVoteCount(candidateId) {
    let totalVotes = 0;

    // Query all shards in parallel
    const shardPromises = [];
    for (let i = 0; i < SHARD_CONFIG.VOTE_SHARD_COUNT; i++) {
      const shardedKey = `${candidateId}#SHARD_${i}`;
      shardPromises.push(
        docClient.send(new GetCommand({
          TableName: TABLE_NAMES.VOTE_RESULTS,
          Key: { CandidateId: shardedKey }
        }))
      );
    }

    const results = await Promise.all(shardPromises);
    
    // Aggregate votes from all shards
    for (const result of results) {
      if (result.Item) {
        totalVotes += result.Item.votes || 0;
      }
    }

    return totalVotes;
  }

  /**
   * Get all vote results aggregated by candidate
   * @returns {Promise<Array>} Array of {candidateId, votes}
   */
  async getAllVoteResults() {
    // Scan all items from VoteResults table
    const { Items = [] } = await docClient.send(new ScanCommand({
      TableName: TABLE_NAMES.VOTE_RESULTS
    }));

    // Group by base candidate ID and aggregate
    const voteMap = new Map();
    
    for (const item of Items) {
      const baseCandidateId = item.baseCandidateId || item.CandidateId.split('#')[0];
      const currentVotes = voteMap.get(baseCandidateId) || 0;
      voteMap.set(baseCandidateId, currentVotes + (item.votes || 0));
    }

    // Convert to array format matching original structure
    return Array.from(voteMap.entries()).map(([candidateId, votes]) => ({
      CandidateId: candidateId,
      votes
    }));
  }

  /**
   * Check if user has already voted
   * @param {string} userId 
   * @returns {Promise<boolean>}
   */
  async hasUserVoted(userId) {
    // This check is implicit in processVote transaction
    // Can be implemented separately if needed for read-only checks
    return false;
  }
}

export const voteRepository = new VoteRepository();
