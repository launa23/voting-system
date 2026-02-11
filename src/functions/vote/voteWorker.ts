/**
 * Vote Worker Lambda Handler
 * Processes votes from SQS queue
 * 
 * THIS IS A THIN HANDLER - Business logic is in VoteService
 */

import { SQSEvent, SQSBatchResponse } from "../../core/models/types.js";
import { voteService } from "../../core/services/VoteService.js";

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  try {
    // Process batch of votes from SQS
    const batchItemFailures = await voteService.processBatchVotes(event.Records);
    
    // Return failed message IDs for retry
    return { batchItemFailures };
  } catch (error) {
    console.error('Unexpected error in vote worker:', error);
    // Return all messages as failed for retry
    return {
      batchItemFailures: event.Records.map(record => ({
        itemIdentifier: record.messageId
      }))
    };
  }
};
