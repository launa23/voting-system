/**
 * Upload Lambda Handler
 * Generates pre-signed URLs for S3 uploads
 * 
 * THIS IS A THIN HANDLER - Business logic is in UploadService
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "../../core/models/types.js";
import { uploadService } from "../../core/services/UploadService.js";
import {
  successResponse,
  errorResponse,
  parseBody,
  ValidationError
} from "../../shared/utils/response.js";
import { HTTP_STATUS } from "../../shared/utils/constants.js";

interface UploadBody {
  fileName: string;
  fileType?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = parseBody<UploadBody>(event);
    const { fileName, fileType } = body;
    
    // Generate upload URL
    const uploadData = await uploadService.generateUploadUrl(fileName, fileType);
    
    return successResponse(HTTP_STATUS.OK, uploadData);
    
  } catch (error) {
    console.error('Upload handler error:', error);
    
    // Handle custom errors
    if (error instanceof ValidationError) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, error);
    }
    
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, error as Error);
  }
};
