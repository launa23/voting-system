/**
 * User Info Lambda Handler
 * Returns user information from Cognito
 * 
 * THIS IS A THIN HANDLER - Business logic is in AuthService
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "../../core/models/types.js";
import { authService } from "../../core/services/AuthService.js";
import {
  successResponse,
  errorResponse,
  corsResponse,
  getHttpMethod,
  getAuthToken,
  UnauthorizedError,
  NotFoundError
} from "../../shared/utils/response.js";
import { HTTP_STATUS, HTTP_METHODS } from "../../shared/utils/constants.js";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (getHttpMethod(event) === HTTP_METHODS.OPTIONS) {
      return corsResponse();
    }

    // Get access token from headers
    const accessToken = getAuthToken(event);
    
    if (!accessToken) {
      throw new UnauthorizedError('No access token provided');
    }

    // Get user info from Cognito
    const userInfo = await authService.getUserInfo(accessToken);
    
    return successResponse(HTTP_STATUS.OK, userInfo);
    
  } catch (error) {
    console.error('User info error:', error);
    
    // Handle custom errors
    if (error instanceof UnauthorizedError) {
      return errorResponse(HTTP_STATUS.UNAUTHORIZED, error);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, error);
    }
    
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, error as Error);
  }
};
