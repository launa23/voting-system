/**
 * Upload Service
 * Business logic for file upload operations
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ValidationError } from "../../shared/utils/response.mjs";
import { S3_CONFIG } from "../../shared/utils/constants.mjs";

const s3Client = new S3Client({});

export class UploadService {
  constructor() {
    this.bucketName = process.env.BUCKET_NAME;
  }

  /**
   * Generate pre-signed URL for file upload
   * @param {string} fileName 
   * @param {string} [fileType='image/jpeg'] 
   * @returns {Promise<Object>}
   */
  async generateUploadUrl(fileName, fileType = 'image/jpeg') {
    if (!fileName) {
      throw new ValidationError('fileName is required');
    }

    // Create unique key for file
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `candidates/${timestamp}-${sanitizedFileName}`;
    
    // Create pre-signed URL for upload
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: S3_CONFIG.UPLOAD_EXPIRATION
    });
    
    // Public URL to access after upload
    const publicUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${key}`;
    
    return {
      uploadUrl,
      publicUrl,
      key,
      expiresIn: S3_CONFIG.UPLOAD_EXPIRATION
    };
  }

  /**
   * Validate file type
   * @param {string} fileType 
   * @returns {boolean}
   */
  isValidFileType(fileType) {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    return allowedTypes.includes(fileType.toLowerCase());
  }
}

export const uploadService = new UploadService();
