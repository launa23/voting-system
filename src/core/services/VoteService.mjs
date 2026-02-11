/**
 * Vote Service
 * Business logic for voting operations
 */

import { voteRepository } from "../repositories/VoteRepository.mjs";
import { ValidationError, ConflictError } from "../../shared/utils/response.mjs";

export class VoteService {
  /**
   * Process a vote
   * @param {string} userId 
   * @param {string} candidateId 
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async processVote(userId, candidateId) {
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
      if (error.name === 'TransactionCanceledException') {
        // User has already voted
        throw new ConflictError('User has already voted');
      }
      throw error;
    }
  }

  /**
   * Process batch of votes from SQS
   * @param {Array} records - SQS records
   * @returns {Promise<Array>} - List of failed message IDs
   */
  async processBatchVotes(records) {
    const batchItemFailures = [];

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
        if (err.name === 'TransactionCanceledException') {
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
