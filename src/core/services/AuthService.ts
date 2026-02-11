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
import { ValidationError, UnauthorizedError, NotFoundError } from "../../shared/utils/response.js";
import { UserInfo } from "../models/types.js";

const client = new CognitoIdentityProviderClient({ 
  region: process.env.AWS_REGION || 'ap-southeast-1' 
});

interface LoginResponse {
  message: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface SignupResponse {
  message: string;
  userSub: string;
  confirmed: boolean;
}

interface ConfirmSignupResponse {
  message: string;
}

export class AuthService {
  private userPoolClientId: string;
  private userPoolId: string;

  constructor() {
    this.userPoolClientId = process.env.COGNITO_CLIENT_ID || '';
    this.userPoolId = process.env.COGNITO_USER_POOL_ID || '';
  }

  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
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
      
      if (!response.AuthenticationResult) {
        throw new UnauthorizedError('Authentication failed');
      }

      return {
        message: 'Login successful',
        idToken: response.AuthenticationResult.IdToken!,
        accessToken: response.AuthenticationResult.AccessToken!,
        refreshToken: response.AuthenticationResult.RefreshToken!,
        expiresIn: response.AuthenticationResult.ExpiresIn!
      };
    } catch (error) {
      const err = error as { name?: string };
      if (err.name === 'NotAuthorizedException') {
        throw new UnauthorizedError('Invalid email or password');
      }
      if (err.name === 'UserNotFoundException') {
        throw new UnauthorizedError('Invalid email or password');
      }
      throw error;
    }
  }

  /**
   * Register a new user
   */
  async signup(email: string, password: string, name: string | null = null): Promise<SignupResponse> {
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
        userSub: response.UserSub!,
        confirmed: response.UserConfirmed || false
      };
    } catch (error) {
      const err = error as { name?: string };
      if (err.name === 'UsernameExistsException') {
        throw new ValidationError('User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Confirm user signup with code
   */
  async confirmSignup(email: string, confirmationCode: string): Promise<ConfirmSignupResponse> {
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
      const err = error as { name?: string };
      if (err.name === 'CodeMismatchException') {
        throw new ValidationError('Invalid confirmation code');
      }
      if (err.name === 'ExpiredCodeException') {
        throw new ValidationError('Confirmation code has expired');
      }
      throw error;
    }
  }

  /**
   * Auto-confirm user (for development)
   */
  private async autoConfirmUser(email: string): Promise<void> {
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
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    if (!accessToken) {
      throw new UnauthorizedError('Access token is required');
    }

    try {
      const command = new GetUserCommand({
        AccessToken: accessToken
      });

      const response = await client.send(command);
      
      // Parse user attributes
      const attributes: Record<string, string> = {};
      response.UserAttributes?.forEach(attr => {
        if (attr.Name && attr.Value) {
          attributes[attr.Name] = attr.Value;
        }
      });
      
      return {
        username: response.Username!,
        userId: attributes.sub,
        email: attributes.email,
        name: attributes.name || null,
        emailVerified: attributes.email_verified === 'true',
        attributes: attributes
      };
    } catch (error) {
      const err = error as { name?: string };
      if (err.name === 'NotAuthorizedException') {
        throw new UnauthorizedError('Invalid or expired token');
      }
      if (err.name === 'UserNotFoundException') {
        throw new NotFoundError('User not found');
      }
      throw error;
    }
  }
}

export const authService = new AuthService();
