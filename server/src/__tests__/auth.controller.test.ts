import {AuthController} from '../modules/auth/auth.controller';
import {AuthService} from '../modules/auth/auth.service';
import {CryptoService} from '../services/crypto.service';
import {GithubService} from '../services/github.service';
import {prisma} from '../db';
import {config} from '../config';

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

/**
 * Test suite for the AuthController.
 * This suite verifies the functionality of authentication-related endpoints,
 * including GitHub OAuth flow, session management, and user data retrieval.
 */
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

  /**
   * Tests for the GitHub login initiation endpoint.
   */
  describe('githubLogin', () => {
    /**
     * Verifies that the controller correctly generates state, sets a cookie,
     * and redirects the user to the GitHub authorization URL.
     */
    it('should redirect to GitHub OAuth URL', () => {
      const mockState = 'random-state';
      const mockAuthUrl = 'https://github.com/login/oauth/authorize?params';
      mockAuthService.generateAuthState.mockReturnValue(mockState);
      mockAuthService.getGithubAuthUrl.mockReturnValue(mockAuthUrl);

      authController.githubLogin(mockReq, mockRes);

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

    /**
     * Ensures the 'secure' flag is set on cookies in a production environment.
     */
    it('should set secure cookie in production', () => {
      const originalEnv = config.NODE_ENV;
      (config as any).NODE_ENV = 'production';
      mockAuthService.generateAuthState.mockReturnValue('state');
      mockAuthService.getGithubAuthUrl.mockReturnValue('url');

      authController.githubLogin(mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'oauth_state',
        'state',
        expect.objectContaining({ secure: true })
      );

      (config as any).NODE_ENV = originalEnv;
    });
  });

  /**
   * Tests for the GitHub OAuth callback endpoint.
   */
  describe('githubCallback', () => {
    /**
     * Verifies the successful handling of a valid OAuth callback, including
     * token exchange, user creation, session creation, and redirection.
     */
    it('should handle successful OAuth callback', async () => {
      mockReq.query = { code: 'auth-code', state: 'valid-state' };
      mockReq.cookies = { oauth_state: 'valid-state' };
      const mockToken = 'github-token';
      const mockUser = { id: 1, githubId: 123 };
      const mockJwt = 'jwt-token';

      mockAuthService.exchangeCodeForToken.mockResolvedValue(mockToken);
      mockAuthService.findOrCreateUser.mockResolvedValue(mockUser as any);
      mockAuthService.createJwtForUser.mockReturnValue(mockJwt);

      await authController.githubCallback(mockReq, mockRes);

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

    /**
     * Ensures a 400 Bad Request response if required query parameters are missing.
     */
    it('should return 400 for missing parameters', async () => {
      mockReq.query = {};
      mockReq.cookies = {};

      await authController.githubCallback(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith('Authentication error: Missing required parameters.');
    });

    /**
     * Ensures a 400 Bad Request response if the OAuth state parameter is invalid,
     * preventing CSRF attacks.
     */
    it('should return 400 for invalid state', async () => {
      mockReq.query = { code: 'code', state: 'invalid' };
      mockReq.cookies = { oauth_state: 'valid' };

      await authController.githubCallback(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith('Invalid state parameter. Request aborted for security reasons.');
    });

    /**
     * Verifies that errors during the OAuth token exchange are handled gracefully
     * and result in a 500 Internal Server Error response.
     */
    it('should handle OAuth errors', async () => {
      mockReq.query = { code: 'code', state: 'state' };
      mockReq.cookies = { oauth_state: 'state' };
      mockAuthService.exchangeCodeForToken.mockRejectedValue(new Error('OAuth failed'));

      await authController.githubCallback(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('An internal server error occurred during authentication.');
    });
  });

  /**
   * Tests for the endpoint that retrieves the currently authenticated user.
   */
  describe('getCurrentUser', () => {
    /**
     * Verifies that the endpoint returns a null user when no session is active.
     */
    it('should return null when no user in request', async () => {
      await authController.getCurrentUser(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ user: null });
    });

    /**
     * Verifies that the endpoint returns the correct user data for an authenticated session.
     * It also checks that the PAT status is correctly represented.
     */
    it('should return user data when user exists', async () => {
      mockReq.user = { id: 1 };
      const mockUser = {
        id: 1,
        login: 'testuser',
        name: 'Test User',
        avatarUrl: 'avatar.png',
        githubPat: 'encrypted-pat',
      };
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);

      await authController.getCurrentUser(mockReq, mockRes);

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

  /**
   * Tests for the user logout endpoint.
   */
  describe('logout', () => {
    /**
     * Verifies that the logout process correctly clears the session cookie
     * and sends a successful response.
     */
    it('should clear session cookie and respond', () => {
      authController.logout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('session', { path: '/' });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });
  });

  /**
   * Tests for the endpoint that updates a user's GitHub Personal Access Token.
   */
  describe('updateGithubPat', () => {
    /**
     * Verifies the successful update of a user's PAT.
     */
    it('should update PAT successfully', async () => {
      mockReq.body = { pat: 'ghp_validtoken123' };
      mockReq.user = { id: 1 };
      const mockUpdatedUser = { id: 1, githubPat: 'encrypted' };
      mockAuthService.updateUserPat.mockResolvedValue(mockUpdatedUser as any);

      await authController.updateGithubPat(mockReq, mockRes);

      expect(mockAuthService.updateUserPat).toHaveBeenCalledWith(1, 'ghp_validtoken123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Token updated successfully.' });
    });

    /**
     * Ensures that tokens with an invalid format are rejected with a 400 Bad Request.
     */
    it('should return 400 for invalid PAT format', async () => {
      mockReq.body = { pat: 'invalid-token' };

      await authController.updateGithubPat(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid GitHub Personal Access Token format.' });
    });
  });
});