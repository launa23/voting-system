/**
 * HTTP Response Builder
 * Standardized response format for all Lambda functions
 */

export const successResponse = (statusCode, data, cacheControl = null) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
  
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }
  
  return {
    statusCode,
    headers,
    body: JSON.stringify(data),
  };
};

export const errorResponse = (statusCode, error, message = null) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify({
      error: message || error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
    }),
  };
};

export const corsResponse = () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: '',
  };
};

/**
 * Parse request body safely
 */
export const parseBody = (event) => {
  try {
    return JSON.parse(event.body || '{}');
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }
};

/**
 * Extract HTTP method from event (supports both versions)
 */
export const getHttpMethod = (event) => {
  return event.requestContext?.http?.method || event.httpMethod;
};

/**
 * Extract path parameters
 */
export const getPathParameters = (event) => {
  return event.pathParameters || {};
};

/**
 * Extract auth token from headers
 */
export const getAuthToken = (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Remove "Bearer " prefix
  return authHeader.replace(/^Bearer\s+/i, '');
};

/**
 * Custom Error Classes
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}
