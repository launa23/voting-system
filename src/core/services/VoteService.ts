/**
 * Vote Service
 * Business logic for voting operations
 */

import { voteRepository } from "../repositories/VoteRepository.js";
import { ValidationError, ConflictError } from "../../shared/utils/response.js";
import { SQSRecord, BatchItemFailure } from "../models/types.js";

interface VoteProcessResult {
  success: boolean;
  message: string;
}

export class VoteService {
  /**
   * Process a vote
   */
  async processVote(userId: string, candidateId: string): Promise<VoteProcessResult> {
    // Validate input
    if (!userId || !candidateId) {
      throw new ValidationError('userId and candidateId are required');
    }

    try {
      await voteRepository.processVote(userId, candidateId);
      
      return {
        success: true,
        message: `Vote processed successfully for candidate ${candidateId}`
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'TransactionCanceledException') {
        // User has already voted
        throw new ConflictError('User has already voted');
      }
      throw error;
    }
  }

  /**
   * Process batch of votes from SQS
   */
  async processBatchVotes(records: SQSRecord[]): Promise<BatchItemFailure[]> {
    const batchItemFailures: BatchItemFailure[] = [];

    const promises = records.map(async (record) => {
      try {
        const body = JSON.parse(record.body);
        const { userId, candidateId } = body;

        // Skip invalid messages (don't retry)
        if (!userId || !candidateId) {
          console.warn('Invalid message, missing userId or candidateId:', record.messageId);
          return;
        }

        await voteRepository.processVote(userId, candidateId);
        console.log(`Successfully processed vote: ${userId} -> ${candidateId}`);

      } catch (err) {
        const error = err as { name?: string };
        if (error.name === 'TransactionCanceledException') {
          // Duplicate vote - ignore silently (don't retry)
          console.log(`Duplicate vote ignored for user: ${JSON.parse(record.body).userId}`);
        } else {
          // Real system error - mark for retry
          console.error("System Error for message:", record.messageId, err);
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      }
    });

    await Promise.all(promises);
    return batchItemFailures;
  }
}

export const voteService = new VoteService();
