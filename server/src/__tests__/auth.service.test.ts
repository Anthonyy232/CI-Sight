import jwt from 'jsonwebtoken';
import axios from 'axios';
import {AuthService} from '../modules/auth/auth.service';
import {CryptoService} from '../services/crypto.service';
import {GithubService} from '../services/github.service';
import {prisma} from '../db';

// Mock all dependencies
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
jest.mock('jsonwebtoken', () => ({
  default: {
    sign: jest.fn(),
  },
  sign: jest.fn(),
}));
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

describe('AuthService', () => {
  let authService: AuthService;
  let mockCryptoService: jest.Mocked<CryptoService>;
  let mockGithubService: jest.Mocked<GithubService>;

  beforeEach(() => {
    mockCryptoService = new MockedCryptoService() as jest.Mocked<CryptoService>;
    mockGithubService = new MockedGithubService() as jest.Mocked<GithubService>;
    authService = new AuthService(mockCryptoService, mockGithubService);
    jest.clearAllMocks();
  });

  describe('generateAuthState', () => {
    it('should generate a random hex string', () => {
      // Act
      const state = authService.generateAuthState();

      // Assert
      expect(state).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('getGithubAuthUrl', () => {
    it('should construct correct GitHub OAuth URL', () => {
      // Arrange
      const redirectUri = 'https://example.com/callback';
      const state = 'test-state';

      // Act
      const url = authService.getGithubAuthUrl(redirectUri, state);

      // Assert
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=mock-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('scope=repo%2Cread%3Auser');
      expect(url).toContain('state=test-state');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for access token', async () => {
      // Arrange
      const code = 'auth-code';
      const redirectUri = 'https://example.com/callback';
      const mockTokenResponse = { access_token: 'github-token' };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Act
      const result = await authService.exchangeCodeForToken(code, redirectUri);

      // Assert
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
      expect(result).toBe('github-token');
    });

    it('should throw error when no access token in response', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      // Act & Assert
      await expect(
        authService.exchangeCodeForToken('code', 'uri')
      ).rejects.toThrow('Failed to retrieve access token from GitHub');
    });
  });

  describe('findOrCreateUser', () => {
    it('should find existing user and update', async () => {
      // Arrange
      const githubToken = 'token';
      const githubUser = {
        id: 123,
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'avatar.png',
      };
      const encryptedToken = 'encrypted-token';
      const existingUser = { id: 1, githubId: 123 };

      mockGithubService.fetchUserFromToken.mockResolvedValue(githubUser);
      mockCryptoService.encrypt.mockReturnValue(encryptedToken);
      (mockedPrisma.user.upsert as jest.Mock).mockResolvedValue(existingUser as any);

      // Act
      const result = await authService.findOrCreateUser(githubToken);

      // Assert
      expect(mockGithubService.fetchUserFromToken).toHaveBeenCalledWith(githubToken);
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(githubToken);
      expect(mockedPrisma.user.upsert).toHaveBeenCalledWith({
        where: { githubId: 123 },
        update: {
          login: 'testuser',
          name: 'Test User',
          avatarUrl: 'avatar.png',
          accessToken: encryptedToken,
        },
        create: {
          githubId: 123,
          login: 'testuser',
          name: 'Test User',
          avatarUrl: 'avatar.png',
          accessToken: encryptedToken,
        },
      });
      expect(result).toEqual(existingUser);
    });
  });

  describe('createJwtForUser', () => {
    it('should create JWT token for user', () => {
      // Arrange
      const user = { id: 1, githubId: 123 };
      const mockToken = 'jwt-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = authService.createJwtForUser(user);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: '1', githubId: 123 },
        'mock-jwt-secret',
        { expiresIn: '7d', algorithm: 'HS256' }
      );
      expect(result).toBe(mockToken);
    });
  });

  describe('updateUserPat', () => {
    it('should update user PAT', async () => {
      // Arrange
      const userId = 1;
      const pat = 'ghp_token';
      const encryptedPat = 'encrypted-pat';
      const updatedUser = { id: 1, githubPat: encryptedPat };

      mockCryptoService.encrypt.mockReturnValue(encryptedPat);
      (mockedPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser as any);

      // Act
      const result = await authService.updateUserPat(userId, pat);

      // Assert
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(pat);
      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { githubPat: encryptedPat },
      });
      expect(result).toEqual(updatedUser);
    });
  });
});