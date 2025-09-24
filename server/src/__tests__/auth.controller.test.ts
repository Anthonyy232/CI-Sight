import {AuthController} from '../modules/auth/auth.controller';
import {AuthService} from '../modules/auth/auth.service';
import {CryptoService} from '../services/crypto.service';
import {GithubService} from '../services/github.service';
import {prisma} from '../db';
import {config} from '../config';

// Mock dependencies
jest.mock('../modules/auth/auth.service');
jest.mock('../services/crypto.service');
jest.mock('../services/github.service');
jest.mock('../db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../config', () => ({
  config: {
    FRONTEND_URL: 'https://frontend.com',
    PUBLIC_URL: 'https://backend.com',
    NODE_ENV: 'development',
  },
}));

const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;
const MockedCryptoService = CryptoService as jest.MockedClass<typeof CryptoService>;
const MockedGithubService = GithubService as jest.MockedClass<typeof GithubService>;
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    const mockCryptoService = new MockedCryptoService() as jest.Mocked<CryptoService>;
    const mockGithubService = new MockedGithubService() as jest.Mocked<GithubService>;
    mockAuthService = new MockedAuthService(mockCryptoService, mockGithubService) as jest.Mocked<AuthService>;
    authController = new AuthController(mockAuthService);
    mockReq = {};
    mockRes = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('githubLogin', () => {
    it('should redirect to GitHub OAuth URL', () => {
      // Arrange
      const mockState = 'random-state';
      const mockAuthUrl = 'https://github.com/login/oauth/authorize?params';
      mockAuthService.generateAuthState.mockReturnValue(mockState);
      mockAuthService.getGithubAuthUrl.mockReturnValue(mockAuthUrl);

      // Act
      authController.githubLogin(mockReq, mockRes);

      // Assert
      expect(mockAuthService.generateAuthState).toHaveBeenCalled();
      expect(mockAuthService.getGithubAuthUrl).toHaveBeenCalledWith(
        'https://frontend.com/api/auth/github/callback',
        mockState
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'oauth_state',
        mockState,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
        })
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(mockAuthUrl);
    });

    it('should set secure cookie in production', () => {
      // Arrange
      const originalEnv = config.NODE_ENV;
      (config as any).NODE_ENV = 'production';
      mockAuthService.generateAuthState.mockReturnValue('state');
      mockAuthService.getGithubAuthUrl.mockReturnValue('url');

      // Act
      authController.githubLogin(mockReq, mockRes);

      // Assert
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'oauth_state',
        'state',
        expect.objectContaining({ secure: true })
      );

      // Cleanup
      (config as any).NODE_ENV = originalEnv;
    });
  });

  describe('githubCallback', () => {
    it('should handle successful OAuth callback', async () => {
      // Arrange
      mockReq.query = { code: 'auth-code', state: 'valid-state' };
      mockReq.cookies = { oauth_state: 'valid-state' };
      const mockToken = 'github-token';
      const mockUser = { id: 1, githubId: 123 };
      const mockJwt = 'jwt-token';

      mockAuthService.exchangeCodeForToken.mockResolvedValue(mockToken);
      mockAuthService.findOrCreateUser.mockResolvedValue(mockUser as any);
      mockAuthService.createJwtForUser.mockReturnValue(mockJwt);

      // Act
      await authController.githubCallback(mockReq, mockRes);

      // Assert
      expect(mockAuthService.exchangeCodeForToken).toHaveBeenCalledWith(
        'auth-code',
        'https://frontend.com/api/auth/github/callback'
      );
      expect(mockAuthService.findOrCreateUser).toHaveBeenCalledWith(mockToken);
      expect(mockAuthService.createJwtForUser).toHaveBeenCalledWith(mockUser);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'session',
        mockJwt,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
        })
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith('oauth_state');
      expect(mockRes.redirect).toHaveBeenCalledWith('https://frontend.com');
    });

    it('should return 400 for missing parameters', async () => {
      // Arrange
      mockReq.query = {};
      mockReq.cookies = {};

      // Act
      await authController.githubCallback(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith('Authentication error: Missing required parameters.');
    });

    it('should return 400 for invalid state', async () => {
      // Arrange
      mockReq.query = { code: 'code', state: 'invalid' };
      mockReq.cookies = { oauth_state: 'valid' };

      // Act
      await authController.githubCallback(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith('Invalid state parameter. Request aborted for security reasons.');
    });

    it('should handle OAuth errors', async () => {
      // Arrange
      mockReq.query = { code: 'code', state: 'state' };
      mockReq.cookies = { oauth_state: 'state' };
      mockAuthService.exchangeCodeForToken.mockRejectedValue(new Error('OAuth failed'));

      // Act
      await authController.githubCallback(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('An internal server error occurred during authentication.');
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no user in request', async () => {
      // Act
      await authController.getCurrentUser(mockReq, mockRes);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({ user: null });
    });

    it('should return user data when user exists', async () => {
      // Arrange
      mockReq.user = { id: 1 };
      const mockUser = {
        id: 1,
        login: 'testuser',
        name: 'Test User',
        avatarUrl: 'avatar.png',
        githubPat: 'encrypted-pat',
      };
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);

      // Act
      await authController.getCurrentUser(mockReq, mockRes);

      // Assert
      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, login: true, name: true, avatarUrl: true, githubPat: true },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        user: {
          id: 1,
          login: 'testuser',
          name: 'Test User',
          avatarUrl: 'avatar.png',
          hasPat: true,
        },
      });
    });
  });

  describe('logout', () => {
    it('should clear session cookie and respond', () => {
      // Act
      authController.logout(mockReq, mockRes);

      // Assert
      expect(mockRes.clearCookie).toHaveBeenCalledWith('session', { path: '/' });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });
  });

  describe('updateGithubPat', () => {
    it('should update PAT successfully', async () => {
      // Arrange
      mockReq.body = { pat: 'ghp_validtoken123' };
      mockReq.user = { id: 1 };
      const mockUpdatedUser = { id: 1, githubPat: 'encrypted' };
      mockAuthService.updateUserPat.mockResolvedValue(mockUpdatedUser as any);

      // Act
      await authController.updateGithubPat(mockReq, mockRes);

      // Assert
      expect(mockAuthService.updateUserPat).toHaveBeenCalledWith(1, 'ghp_validtoken123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Token updated successfully.' });
    });

    it('should return 400 for invalid PAT format', async () => {
      // Arrange
      mockReq.body = { pat: 'invalid-token' };

      // Act
      await authController.updateGithubPat(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid GitHub Personal Access Token format.' });
    });
  });
});