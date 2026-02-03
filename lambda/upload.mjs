// lambda/upload.mjs
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { fileName, fileType } = body;
    
    if (!fileName) {
      return response(400, { error: "fileName is required" });
    }
    
    // Tạo unique key cho file
    const timestamp = Date.now();
    const key = `candidates/${timestamp}-${fileName}`;
    
    // Tạo pre-signed URL cho upload
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType || 'image/jpeg'
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 300 // 5 phút
    });
    
    // Public URL để truy cập sau khi upload
    const publicUrl = `https://${BUCKET_NAME}.s3.ap-southeast-1.amazonaws.com/${key}`;
    
    return response(200, {
      uploadUrl,
      publicUrl,
      key
    });
    
  } catch (error) {
    console.error("Error:", error);
    return response(500, { error: error.message });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}
