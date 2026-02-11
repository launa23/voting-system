/**
 * Authentication Service
 * Business logic for authentication operations
 */

import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminConfirmSignUpCommand,
  GetUserCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { ValidationError, UnauthorizedError, NotFoundError } from "../../shared/utils/response.mjs";

const client = new CognitoIdentityProviderClient({ 
  region: process.env.AWS_REGION || 'ap-southeast-1' 
});

export class AuthService {
  constructor() {
    this.userPoolClientId = process.env.COGNITO_CLIENT_ID;
    this.userPoolId = process.env.COGNITO_USER_POOL_ID;
  }

  /**
   * Login user with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} Auth tokens
   */
  async login(email, password) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.userPoolClientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });

      const response = await client.send(command);
      
      return {
        message: 'Login successful',
        idToken: response.AuthenticationResult.IdToken,
        accessToken: response.AuthenticationResult.AccessToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn
      };
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw new UnauthorizedError('Invalid email or password');
      }
      if (error.name === 'UserNotFoundException') {
        throw new UnauthorizedError('Invalid email or password');
      }
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {string} email 
   * @param {string} password 
   * @param {string} [name] 
   * @returns {Promise<Object>}
   */
  async signup(email, password, name = null) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    try {
      const userAttributes = [
        { Name: 'email', Value: email }
      ];
      
      if (name) {
        userAttributes.push({ Name: 'name', Value: name });
      }

      const command = new SignUpCommand({
        ClientId: this.userPoolClientId,
        Username: email,
        Password: password,
        UserAttributes: userAttributes
      });

      const response = await client.send(command);
      
      // Auto-confirm user (development mode)
      if (process.env.AUTO_CONFIRM_USER === 'true') {
        await this.autoConfirmUser(email);
      }
      
      return {
        message: 'Signup successful',
        userSub: response.UserSub,
        confirmed: response.UserConfirmed || false
      };
    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        throw new ValidationError('User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Confirm user signup with code
   * @param {string} email 
   * @param {string} confirmationCode 
   * @returns {Promise<Object>}
   */
  async confirmSignup(email, confirmationCode) {
    if (!email || !confirmationCode) {
      throw new ValidationError('Email and confirmation code are required');
    }

    try {
      const command = new ConfirmSignUpCommand({
        ClientId: this.userPoolClientId,
        Username: email,
        ConfirmationCode: confirmationCode
      });

      await client.send(command);
      
      return {
        message: 'Email confirmed successfully'
      };
    } catch (error) {
      if (error.name === 'CodeMismatchException') {
        throw new ValidationError('Invalid confirmation code');
      }
      if (error.name === 'ExpiredCodeException') {
        throw new ValidationError('Confirmation code has expired');
      }
      throw error;
    }
  }

  /**
   * Auto-confirm user (for development)
   * @param {string} email 
   * @private
   */
  async autoConfirmUser(email) {
    try {
      const command = new AdminConfirmSignUpCommand({
        UserPoolId: this.userPoolId,
        Username: email
      });
      
      await client.send(command);
      console.log(`Auto-confirmed user: ${email}`);
    } catch (error) {
      console.error('Auto-confirm failed:', error);
    }
  }

  /**
   * Get user information from access token
   * @param {string} accessToken 
   * @returns {Promise<Object>}
   */
  async getUserInfo(accessToken) {
    if (!accessToken) {
      throw new UnauthorizedError('Access token is required');
    }

    try {
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
        username: response.Username,
        userId: attributes.sub,
        email: attributes.email,
        name: attributes.name || null,
        emailVerified: attributes.email_verified === 'true',
        attributes: attributes
      };
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw new UnauthorizedError('Invalid or expired token');
      }
      if (error.name === 'UserNotFoundException') {
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  }
}

export const authService = new AuthService();
