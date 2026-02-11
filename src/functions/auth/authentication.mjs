/**
 * Authentication Lambda Handler
 * Handles login, signup, and confirm endpoints
 * 
 * THIS IS A THIN HANDLER - Business logic is in AuthService
 */

import { authService } from "../../core/services/AuthService.mjs";
import { 
  successResponse, 
  errorResponse, 
  corsResponse, 
  parseBody,
  getHttpMethod,
  ValidationError,
  UnauthorizedError,
  NotFoundError
} from "../../shared/utils/response.mjs";
import { HTTP_STATUS } from "../../shared/utils/constants.mjs";

export const handler = async (event) => {
  try {
    // Handle CORS preflight
    if (getHttpMethod(event) === 'OPTIONS') {
      return corsResponse();
    }

    const body = parseBody(event);
    const path = event.rawPath || event.path;
    
    // Route to appropriate service method
    if (path.includes('/login')) {
      const result = await authService.login(body.email, body.password);
      return successResponse(HTTP_STATUS.OK, result);
    } 
    
    if (path.includes('/signup')) {
      const result = await authService.signup(body.email, body.password, body.name);
      return successResponse(HTTP_STATUS.CREATED, result);
    } 
    
    if (path.includes('/confirm')) {
      const result = await authService.confirmSignup(body.email, body.confirmationCode);
      return successResponse(HTTP_STATUS.OK, result);
    }
    
    return errorResponse(HTTP_STATUS.BAD_REQUEST, new Error('Invalid endpoint'));
    
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Handle custom errors
    if (error instanceof ValidationError) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, error);
    }
    if (error instanceof UnauthorizedError) {
      return errorResponse(HTTP_STATUS.UNAUTHORIZED, error);
    }
    
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, error);
  }
};
