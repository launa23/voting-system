/**
 * Upload Lambda Handler
 * Generates pre-signed URLs for S3 uploads
 * 
 * THIS IS A THIN HANDLER - Business logic is in UploadService
 */

import { uploadService } from "../../core/services/UploadService.mjs";
import {
  successResponse,
  errorResponse,
  parseBody,
  ValidationError
} from "../../shared/utils/response.mjs";
import { HTTP_STATUS } from "../../shared/utils/constants.mjs";

export const handler = async (event) => {
  try {
    const body = parseBody(event);
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
    
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, error);
  }
};
