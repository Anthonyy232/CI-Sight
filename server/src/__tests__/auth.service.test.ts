import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AuthService } from '../modules/auth/auth.service';
import { CryptoService } from '../services/crypto.service';
import { GithubService } from '../services/github.service';
import { prisma } from '../db';
import { User } from '@prisma/client';

jest.mock('../services/crypto.service');
jest.mock('../services/github.service');
jest.mock('../db', () => ({
  prisma: {
    user: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('axios');
jest.mock('jsonwebtoken');
jest.mock('../config', () => ({
  config: {
    GITHUB_OAUTH_CLIENT_ID: 'mock-client-id',
    GITHUB_OAUTH_CLIENT_SECRET: 'mock-client-secret',
    SESSION_JWT_SECRET: 'mock-jwt-secret',
  },
}));

const MockedCryptoService = CryptoService as jest.MockedClass<typeof CryptoService>;
const MockedGithubService = GithubService as jest.MockedClass<typeof GithubService>;
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

/**
 * Test suite for the AuthService.
 * This suite covers the core business logic for authentication, including
 * interaction with the GitHub API, user management, and JWT creation.
 */
describe('AuthService', () => {
  let authService: AuthService;
  let mockCryptoService: jest.Mocked<CryptoService>;
  let mockGithubService: jest.Mocked<GithubService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCryptoService = new MockedCryptoService() as jest.Mocked<CryptoService>;
    mockGithubService = new MockedGithubService() as jest.Mocked<GithubService>;
    authService = new AuthService(mockCryptoService, mockGithubService);
  });

  /**
   * Tests for the OAuth state generation logic.
   */
  describe('generateAuthState', () => {
    /**
     * Verifies that the generated state is a 32-character hexadecimal string,
     * suitable for use in an OAuth flow.
     */
    it('should generate a 32-character hexadecimal string', () => {
      const state = authService.generateAuthState();

      expect(typeof state).toBe('string');
      expect(state).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  /**
   * Tests for the construction of the GitHub OAuth URL.
   */
  describe('getGithubAuthUrl', () => {
    /**
     * Ensures the generated URL is correctly formatted with all necessary parameters,
     * including client ID, redirect URI, scope, and state.
     */
    it('should construct the correct GitHub OAuth URL with all parameters', () => {
      const redirectUri = 'https://example.com/callback';
      const state = 'test-state-123';

      const url = authService.getGithubAuthUrl(redirectUri, state);

      const expectedParams = new URLSearchParams({
        client_id: 'mock-client-id',
        redirect_uri: redirectUri,
        scope: 'repo,read:user',
        state: state,
      });
      expect(url).toBe(`https://github.com/login/oauth/authorize?${expectedParams.toString()}`);
    });
  });

  /**
   * Tests for the exchange of an OAuth code for a GitHub access token.
   */
  describe('exchangeCodeForToken', () => {
    /**
     * Verifies the successful exchange of an authorization code for an access token.
     */
    it('should successfully exchange an authorization code for an access token', async () => {
      const code = 'auth-code';
      const redirectUri = 'https://example.com/callback';
      const mockTokenResponse = { data: { access_token: 'github-access-token' } };
      mockedAxios.post.mockResolvedValue(mockTokenResponse);

      const accessToken = await authService.exchangeCodeForToken(code, redirectUri);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        {
          client_id: 'mock-client-id',
          client_secret: 'mock-client-secret',
          code,
          redirect_uri: redirectUri,
        },
        { headers: { Accept: 'application/json' } }
      );
      expect(accessToken).toBe('github-access-token');
    });

    /**
     * Ensures that an error is thrown if the GitHub API response is missing the access token.
     */
    it('should throw an error if the GitHub API response does not contain an access token', async () => {
      mockedAxios.post.mockResolvedValue({ data: { error: 'bad_verification_code' } });

      await expect(authService.exchangeCodeForToken('bad-code', 'uri')).rejects.toThrow(
        'Failed to retrieve access token from GitHub'
      );
    });
  });

  /**
   * Tests for finding an existing user or creating a new one based on GitHub profile data.
   */
  describe('findOrCreateUser', () => {
    /**
     * Verifies the complete flow of fetching user data from GitHub, encrypting the token,
     * and using `upsert` to create or update the user in the database.
     */
    it('should fetch GitHub user, encrypt token, and upsert user in the database', async () => {
      const githubToken = 'gho_token';
      const githubUser = {
        id: 12345,
        login: 'test-user',
        name: 'Test User',
        avatar_url: 'https://avatar.url/test.png',
      };
      const encryptedToken = 'encrypted-gho-token';
      const upsertedUser: User = {
        id: 1,
        githubId: 12345,
        login: 'test-user',
        name: 'Test User',
        avatarUrl: 'https://avatar.url/test.png',
        accessToken: encryptedToken,
        githubPat: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGithubService.fetchUserFromToken.mockResolvedValue(githubUser);
      mockCryptoService.encrypt.mockReturnValue(encryptedToken);
      (mockedPrisma.user.upsert as jest.Mock).mockResolvedValue(upsertedUser);

      const user = await authService.findOrCreateUser(githubToken);

      expect(mockGithubService.fetchUserFromToken).toHaveBeenCalledWith(githubToken);
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(githubToken);
      expect(mockedPrisma.user.upsert).toHaveBeenCalledWith({
        where: { githubId: githubUser.id },
        update: {
          login: githubUser.login,
          name: githubUser.name,
          avatarUrl: githubUser.avatar_url,
          accessToken: encryptedToken,
        },
        create: {
          githubId: githubUser.id,
          login: githubUser.login,
          name: githubUser.name,
          avatarUrl: githubUser.avatar_url,
          accessToken: encryptedToken,
        },
      });
      expect(user).toEqual(upsertedUser);
    });
  });

  /**
   * Tests for the creation of a session JWT for a user.
   */
  describe('createJwtForUser', () => {
    /**
     * Verifies that the JWT is signed with the correct payload, secret, and options.
     */
    it('should create a signed JWT with the correct payload and options', () => {
      const user = { id: 1, githubId: 12345 };
      const expectedToken = 'signed.jwt.token';
      (mockedJwt.sign as jest.Mock).mockReturnValue(expectedToken);

      const token = authService.createJwtForUser(user);

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        { sub: '1', githubId: 12345 },
        'mock-jwt-secret',
        { expiresIn: '7d', algorithm: 'HS256' }
      );
      expect(token).toBe(expectedToken);
    });
  });

  /**
   * Tests for updating a user's Personal Access Token (PAT).
   */
  describe('updateUserPat', () => {
    /**
     * Verifies that the PAT is correctly encrypted and stored in the database for the specified user.
     */
    it('should encrypt and persist a Personal Access Token for a user', async () => {
      const userId = 1;
      const pat = 'ghp_personalaccesstoken';
      const encryptedPat = 'encrypted-ghp-token';
      const updatedUser: Partial<User> = { id: userId, githubPat: encryptedPat };

      mockCryptoService.encrypt.mockReturnValue(encryptedPat);
      (mockedPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await authService.updateUserPat(userId, pat);

      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(pat);
      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { githubPat: encryptedPat },
      });
      expect(result).toEqual(updatedUser);
    });
  });
});