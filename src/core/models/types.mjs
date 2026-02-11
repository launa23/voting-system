/**
 * Data Models and Type Definitions
 * Using JSDoc for type hints in JavaScript
 */

/**
 * @typedef {Object} Candidate
 * @property {string} CandidateId - Unique identifier
 * @property {string} name - Candidate name
 * @property {string} description - Candidate description
 * @property {string} imageUrl - URL to candidate image
 * @property {number} votes - Vote count (joined from VoteResults)
 */

/**
 * @typedef {Object} VoteResult
 * @property {string} CandidateId - Unique identifier
 * @property {number} votes - Vote count
 */

/**
 * @typedef {Object} UserVoteHistory
 * @property {string} UserId - Unique user identifier
 * @property {string} timestamp - When vote was cast (optional)
 */

/**
 * @typedef {Object} VoteRequest
 * @property {string} userId - User identifier
 * @property {string} candidateId - Candidate identifier
 */

/**
 * @typedef {Object} AuthTokens
 * @property {string} idToken - Cognito ID token
 * @property {string} accessToken - Cognito access token
 * @property {string} refreshToken - Cognito refresh token
 * @property {number} expiresIn - Token expiration in seconds
 */

/**
 * @typedef {Object} UserInfo
 * @property {string} username - Username
 * @property {string} userId - Unique user ID (sub)
 * @property {string} email - User email
 * @property {string|null} name - User display name
 * @property {boolean} emailVerified - Email verification status
 * @property {Object} attributes - All user attributes
 */

/**
 * @typedef {Object} UploadUrlRequest
 * @property {string} fileName - File name
 * @property {string} [fileType] - MIME type (default: image/jpeg)
 */

/**
 * @typedef {Object} UploadUrlResponse
 * @property {string} uploadUrl - Pre-signed URL for upload
 * @property {string} publicUrl - Public URL after upload
 * @property {string} key - S3 object key
 */

export {};
