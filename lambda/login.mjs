import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminConfirmSignUpCommand
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const USER_POOL_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

/**
 * Lambda handler for authentication endpoints
 * Supports: login, signup, confirm
 */
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  try {
    // Handle OPTIONS for CORS
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    const body = JSON.parse(event.body || '{}');
    const path = event.rawPath || event.path;
    
    // Route based on path
    if (path.includes('/login')) {
      return await handleLogin(body, headers);
    } else if (path.includes('/signup')) {
      return await handleSignup(body, headers);
    } else if (path.includes('/confirm')) {
      return await handleConfirm(body, headers);
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid endpoint' })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error'
      })
    };
  }
};

/**
 * Handle user login with Cognito
 */
async function handleLogin(body, headers) {
  const { email, password } = body;
  
  if (!email || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Email and password are required' })
    };
  }

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    });

    const response = await client.send(command);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Login successful',
        idToken: response.AuthenticationResult.IdToken,
        accessToken: response.AuthenticationResult.AccessToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn
      })
    };
    
  } catch (error) {
    console.error('Login error:', error);
    
    let errorMessage = 'Login failed';
    let statusCode = 401;
    
    if (error.name === 'UserNotConfirmedException') {
      errorMessage = 'User not confirmed. Please check your email for confirmation code.';
      statusCode = 403;
    } else if (error.name === 'NotAuthorizedException') {
      errorMessage = 'Incorrect email or password';
    } else if (error.name === 'UserNotFoundException') {
      errorMessage = 'User not found';
    }
    
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: errorMessage })
    };
  }
}

/**
 * Handle user signup with Cognito
 */
async function handleSignup(body, headers) {
  const { email, password, name } = body;
  
  if (!email || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Email and password are required' })
    };
  }

  try {
    const command = new SignUpCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email
        },
        ...(name ? [{
          Name: 'name',
          Value: name
        }] : [])
      ]
    });

    const response = await client.send(command);
    
    // Tự động confirm user (bỏ xác thực email)
    if (!response.UserConfirmed) {
      const confirmCommand = new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: email
      });
      await client.send(confirmCommand);
    }
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'User created successfully. You can now login.',
        userSub: response.UserSub,
        userConfirmed: true
      })
    };
    
  } catch (error) {
    console.error('Signup error:', error);
    
    let errorMessage = 'Signup failed';
    
    if (error.name === 'UsernameExistsException') {
      errorMessage = 'User with this email already exists';
    } else if (error.name === 'InvalidPasswordException') {
      errorMessage = 'Password does not meet requirements';
    } else if (error.name === 'InvalidParameterException') {
      errorMessage = error.message;
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: errorMessage })
    };
  }
}

/**
 * Handle email confirmation
 */
async function handleConfirm(body, headers) {
  const { email, code } = body;
  
  if (!email || !code) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Email and confirmation code are required' })
    };
  }

  try {
    const command = new ConfirmSignUpCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: email,
      ConfirmationCode: code
    });

    await client.send(command);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Email confirmed successfully. You can now login.'
      })
    };
    
  } catch (error) {
    console.error('Confirmation error:', error);
    
    let errorMessage = 'Confirmation failed';
    
    if (error.name === 'CodeMismatchException') {
      errorMessage = 'Invalid confirmation code';
    } else if (error.name === 'ExpiredCodeException') {
      errorMessage = 'Confirmation code has expired';
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: errorMessage })
    };
  }
}
