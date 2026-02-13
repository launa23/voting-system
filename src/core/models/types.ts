/**
 * Data Models and Type Definitions
 */

export interface Candidate {
  CandidateId: string;
  name: string;
  description: string;
  imageUrl: string;
  votes: number; // Joined from VoteResults
}

export interface VoteResult {
  CandidateId: string;
  votes: number;
  baseCandidateId?: string; // For sharded writes
}

export interface UserVoteHistory {
  UserId: string;
  timestamp?: string; // When vote was cast (optional)
}

export interface VoteRequest {
  userId: string;
  candidateId: string;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Token expiration in seconds
}

export interface UserInfo {
  username: string;
  userId: string; // Unique user ID (sub)
  email: string;
  name: string | null; // User display name
  emailVerified: boolean;
  attributes: Record<string, unknown>;
}

export interface UploadUrlRequest {
  fileName: string;
  fileType?: string; // MIME type (default: image/jpeg)
}

export interface UploadUrlResponse {
  uploadUrl: string; // Pre-signed URL for upload
  publicUrl: string; // Public URL after upload
  key: string; // S3 object key
}

// Lambda Event Types
export interface APIGatewayProxyEvent {
  body: string | null;
  headers: Record<string, string>;
  httpMethod: string;
  path: string;
  rawPath?: string; // HTTP API v2
  pathParameters: Record<string, string> | null;
  queryStringParameters: Record<string, string> | null;
  requestContext: {
    http?: {
      method: string;
    };
    authorizer?: {
      claims?: Record<string, string>;
    };
  };
}

export interface APIGatewayProxyResult {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export interface SQSRecord {
  messageId: string;
  body: string;
  attributes: Record<string, string>;
  eventSource: string;
}

export interface SQSEvent {
  Records: SQSRecord[];
}

export interface BatchItemFailure {
  itemIdentifier: string;
}

export interface SQSBatchResponse {
  batchItemFailures: BatchItemFailure[];
}
