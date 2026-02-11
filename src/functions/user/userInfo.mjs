/**
 * User Info Lambda Handler
 * Returns user information from Cognito
 * 
 * THIS IS A THIN HANDLER - Business logic is in AuthService
 */

import { authService } from "../../core/services/AuthService.mjs";
import {
  successResponse,
  errorResponse,
  corsResponse,
  getHttpMethod,
  getAuthToken,
  UnauthorizedError,
  NotFoundError
} from "../../shared/utils/response.mjs";
import { HTTP_STATUS, HTTP_METHODS } from "../../shared/utils/constants.mjs";

export const handler = async (event) => {
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
    
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, error);
  }
};
