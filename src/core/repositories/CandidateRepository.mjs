/**
 * Candidate Repository
 * Handles all database operations for candidates
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  GetCommand,
  PutCommand, 
  UpdateCommand,
  DeleteCommand 
} from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "../../shared/utils/constants.mjs";
import { voteRepository } from "./VoteRepository.mjs";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export class CandidateRepository {
  /**
   * Get all candidates
   * @returns {Promise<Array>}
   */
  async getAllCandidates() {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAMES.CANDIDATES
    }));
    
    return result.Items || [];
  }

  /**
   * Get all vote results (aggregated from sharded writes)
   * @returns {Promise<Array>}
   */
  async getAllVoteResults() {
    return await voteRepository.getAllVoteResults();
  }

  /**
   * Get a single candidate by ID
   * @param {string} candidateId 
   * @returns {Promise<Object|null>}
   */
  async getCandidateById(candidateId) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAMES.CANDIDATES,
      Key: { CandidateId: candidateId }
    }));
    
    return result.Item || null;
  }

  /**
   * Get vote count for a candidate (aggregated from sharded writes)
   * @param {string} candidateId 
   * @returns {Promise<number>}
   */
  async getVoteCount(candidateId) {
    return await voteRepository.getVoteCount(candidateId);
  }

  /**
   * Create a new candidate
   * @param {Object} candidate 
   * @returns {Promise<Object>}
   */
  async createCandidate(candidate) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAMES.CANDIDATES,
      Item: candidate
    }));
    
    return candidate;
  }

  /**
   * Update an existing candidate
   * @param {string} candidateId 
   * @param {Object} updates 
   * @returns {Promise<Object>}
   */
  async updateCandidate(candidateId, updates) {
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.entries(updates).forEach(([key, value], index) => {
      updateExpressions.push(`#field${index} = :value${index}`);
      expressionAttributeNames[`#field${index}`] = key;
      expressionAttributeValues[`:value${index}`] = value;
    });
    
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAMES.CANDIDATES,
      Key: { CandidateId: candidateId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    }));
    
    return result.Attributes;
  }

  /**
   * Delete a candidate
   * @param {string} candidateId 
   */
  async deleteCandidate(candidateId) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAMES.CANDIDATES,
      Key: { CandidateId: candidateId }
    }));
  }
}

export const candidateRepository = new CandidateRepository();
