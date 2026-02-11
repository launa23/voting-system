/**
 * Candidates Lambda Handler
 * Handles CRUD operations for candidates
 * 
 * THIS IS A THIN HANDLER - Business logic is in CandidateService
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "../../core/models/types.js";
import { candidateService } from "../../core/services/CandidateService.js";
import {
  successResponse,
  errorResponse,
  getHttpMethod,
  getPathParameters,
  parseBody,
  ValidationError,
  NotFoundError
} from "../../shared/utils/response.js";
import { HTTP_STATUS, HTTP_METHODS } from "../../shared/utils/constants.js";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const httpMethod = getHttpMethod(event);
    const pathParameters = getPathParameters(event);
    
    // Route based on HTTP method
    switch (httpMethod) {
      case HTTP_METHODS.GET:
        if (pathParameters?.id) {
          // GET /candidates/{id}
          const candidate = await candidateService.getCandidateById(pathParameters.id);
          return successResponse(HTTP_STATUS.OK, candidate);
        }
        // GET /candidates
        const candidates = await candidateService.getAllCandidates();
        return successResponse(
          HTTP_STATUS.OK,
          { candidates },
          "public, max-age=5" // 5 second cache
        );
        
      case HTTP_METHODS.POST: {
        // POST /candidates
        const body = parseBody<{ name: string; description?: string; imageUrl?: string }>(event);
        const newCandidate = await candidateService.createCandidate(body);
        return successResponse(HTTP_STATUS.CREATED, newCandidate);
      }
        
      case HTTP_METHODS.PUT: {
        // PUT /candidates/{id}
        if (!pathParameters?.id) {
          throw new ValidationError('Candidate ID is required');
        }
        const updates = parseBody<{ name?: string; description?: string; imageUrl?: string }>(event);
        const updated = await candidateService.updateCandidate(pathParameters.id, updates);
        return successResponse(HTTP_STATUS.OK, updated);
      }
        
      case HTTP_METHODS.DELETE:
        // DELETE /candidates/{id}
        if (!pathParameters?.id) {
          throw new ValidationError('Candidate ID is required');
        }
        await candidateService.deleteCandidate(pathParameters.id);
        return successResponse(HTTP_STATUS.OK, { 
          message: 'Candidate deleted successfully' 
        });
        
      default:
        return errorResponse(
          HTTP_STATUS.BAD_REQUEST,
          new Error('Method not allowed')
        );
    }
  } catch (error) {
    console.error('Candidates handler error:', error);
    
    // Handle custom errors
    if (error instanceof ValidationError) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, error);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, error);
    }
    
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, error as Error);
  }
};
