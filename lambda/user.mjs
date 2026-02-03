import { 
  CognitoIdentityProviderClient, 
  GetUserCommand
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

/**
 * Lambda handler for user info endpoint
 * Returns user information from Cognito based on access token
 */
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  try {
    // Handle OPTIONS for CORS
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    // Get access token from Authorization header
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No authorization header' })
      };
    }

    // Remove "Bearer " prefix
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!accessToken) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No access token provided' })
      };
    }

    // Get user info from Cognito
    const command = new GetUserCommand({
      AccessToken: accessToken
    });

    const response = await client.send(command);
    
    // Parse user attributes
    const attributes = {};
    response.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        username: response.Username,
        userId: attributes.sub, // Cognito unique user ID
        email: attributes.email,
        name: attributes.name || null,
        emailVerified: attributes.email_verified === 'true',
        attributes: attributes
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (error.name === 'NotAuthorizedException') {
      statusCode = 401;
      errorMessage = 'Invalid or expired token';
    } else if (error.name === 'UserNotFoundException') {
      statusCode = 404;
      errorMessage = 'User not found';
    }
    
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: errorMessage })
    };
  }
};
