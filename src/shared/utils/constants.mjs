/**
 * Application Constants
 */

export const TABLE_NAMES = {
  CANDIDATES: 'Candidates',
  VOTE_RESULTS: 'VoteResults',
  USER_VOTE_HISTORY: 'UserVoteHistory',
};

export const CACHE_CONFIG = {
  CANDIDATES_TTL: 5000, // 5 seconds
};

export const SHARD_CONFIG = {
  // Number of shards for vote writes (distribute hot partitions)
  VOTE_SHARD_COUNT: 10,
};

export const S3_CONFIG = {
  UPLOAD_EXPIRATION: 300, // 5 minutes for pre-signed URLs
};

export const COGNITO_TOKEN_USE = {
  ID_TOKEN: 'id',
  ACCESS_TOKEN: 'access',
};

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  OPTIONS: 'OPTIONS',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};
