/**
 * HTTP Response Builder
 * Standardized response format for all Lambda functions
 */

import { APIGatewayProxyResult } from '../../core/models/types.js';

export const successResponse = (
  statusCode: number,
  data: unknown,
  cacheControl: string | null = null
): APIGatewayProxyResult => {
  const headers: Record<string, string> = {
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

export const errorResponse = (
  statusCode: number,
  error: Error,
  message: string | null = null
): APIGatewayProxyResult => {
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

export const corsResponse = (): APIGatewayProxyResult => {
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
export const parseBody = <T = unknown>(event: { body: string | null }): T => {
  try {
    return JSON.parse(event.body || '{}') as T;
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }
};

/**
 * Extract HTTP method from event (supports both versions)
 */
export const getHttpMethod = (event: {
  requestContext?: { http?: { method: string } };
  httpMethod?: string;
}): string => {
  return event.requestContext?.http?.method || event.httpMethod || '';
};

/**
 * Extract path parameters
 */
export const getPathParameters = (event: {
  pathParameters?: Record<string, string> | null;
}): Record<string, string> => {
  return event.pathParameters || {};
};

/**
 * Extract auth token from headers
 */
export const getAuthToken = (event: {
  headers?: Record<string, string>;
}): string | null => {
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
  statusCode: number;
  
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

export class UnauthorizedError extends Error {
  statusCode: number;
  
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class ConflictError extends Error {
  statusCode: number;
  
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}
