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
import { TABLE_NAMES } from "../../shared/utils/constants.js";
import { voteRepository } from "./VoteRepository.js";
import { Candidate, VoteResult } from "../models/types.js";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export class CandidateRepository {
  /**
   * Get all candidates
   */
  async getAllCandidates(): Promise<Omit<Candidate, 'votes'>[]> {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAMES.CANDIDATES
    }));
    
    return (result.Items || []) as Omit<Candidate, 'votes'>[];
  }

  /**
   * Get all vote results (aggregated from sharded writes)
   */
  async getAllVoteResults(): Promise<VoteResult[]> {
    return await voteRepository.getAllVoteResults();
  }

  /**
   * Get a single candidate by ID
   */
  async getCandidateById(candidateId: string): Promise<Omit<Candidate, 'votes'> | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAMES.CANDIDATES,
      Key: { CandidateId: candidateId }
    }));
    
    return (result.Item as Omit<Candidate, 'votes'>) || null;
  }

  /**
   * Get vote count for a candidate (aggregated from sharded writes)
   */
  async getVoteCount(candidateId: string): Promise<number> {
    return await voteRepository.getVoteCount(candidateId);
  }

  /**
   * Create a new candidate
   */
  async createCandidate(candidate: Omit<Candidate, 'votes'>): Promise<Omit<Candidate, 'votes'>> {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAMES.CANDIDATES,
      Item: candidate
    }));
    
    return candidate;
  }

  /**
   * Update an existing candidate
   */
  async updateCandidate(
    candidateId: string, 
    updates: Partial<Omit<Candidate, 'CandidateId' | 'votes'>>
  ): Promise<Omit<Candidate, 'votes'>> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};
    
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
    
    return result.Attributes as Omit<Candidate, 'votes'>;
  }

  /**
   * Delete a candidate
   */
  async deleteCandidate(candidateId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAMES.CANDIDATES,
      Key: { CandidateId: candidateId }
    }));
  }
}

export const candidateRepository = new CandidateRepository();
