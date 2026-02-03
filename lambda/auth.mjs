import { CognitoJwtVerifier } from "aws-jwt-verify";

/**
 * Lambda Authorizer for validating Cognito JWT tokens
 * This validates the ID token from Cognito and returns authorization decision
 */
export const handler = async (event) => {
  console.log('Auth event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract token from Authorization header
    const headers = event.headers || {};
    const authHeader = headers.authorization || headers.Authorization;
    
    if (!authHeader) {
      console.log('No authorization header');
      return { isAuthorized: false };
    }

    // Remove "Bearer " prefix
    const token = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!token) {
      console.log('No token found');
      return { isAuthorized: false };
    }

    // Create verifier for Cognito ID tokens
    const verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      tokenUse: "id", // or "access" for access tokens
      clientId: process.env.COGNITO_CLIENT_ID,
    });

    // Verify the token
    const payload = await verifier.verify(token);
    console.log('Token verified successfully:', payload);
    
    // Token is valid, return user info in context
    return {
      isAuthorized: true,
      context: {
        userId: payload.sub,
        email: payload.email,
        // Add any other claims you need
      }
    };
    
  } catch (error) {
    console.error('Token verification failed:', error);
    return { isAuthorized: false };
  }
};