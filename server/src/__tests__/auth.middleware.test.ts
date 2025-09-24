import {authMiddleware} from '../middleware/auth.middleware';
import {prisma} from '../db';
import jwt from 'jsonwebtoken';

jest.mock('../db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../config', () => ({
  config: {
    SESSION_JWT_SECRET: 'test-jwt-secret-for-testing-purposes',
  },
}));
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  JsonWebTokenError: jest.fn(),
  TokenExpiredError: jest.fn(),
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

/**
 * Test suite for the authentication middleware.
 * This suite verifies that the middleware correctly handles JWT validation,
 * user lookup, and various error conditions.
 */
describe('Auth Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      cookies: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  /**
   * Tests the successful authentication flow.
   */
  describe('successful authentication', () => {
    /**
     * Verifies that a valid JWT token results in the user object
     * being attached to the request and the next middleware being called.
     */
    it('should authenticate valid JWT token and attach user to request', async () => {
      const mockUser = {
        id: 1,
        login: 'testuser',
        accessToken: 'encrypted-token',
      };
      const mockPayload = { sub: '1', githubId: 123 };
      const validToken = 'valid.jwt.token';

      mockReq.cookies.session = validToken;
      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockedJwt.verify).toHaveBeenCalledWith(validToken, 'test-jwt-secret-for-testing-purposes', {
        algorithms: ['HS256'],
      });
      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockReq.user).toEqual({
        id: 1,
        login: 'testuser',
        accessToken: 'encrypted-token',
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests scenarios where the authentication token is missing.
   */
  describe('missing token', () => {
    /**
     * Ensures a 401 Unauthorized response when the session cookie is not present.
     */
    it('should return 401 when no session cookie is present', async () => {
      mockReq.cookies = {};

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Ensures a 401 Unauthorized response when the session cookie is undefined.
     */
    it('should return 401 when session cookie is undefined', async () => {
      mockReq.cookies.session = undefined;

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests scenarios involving invalid JWT payloads.
   */
  describe('invalid JWT', () => {
    /**
     * Ensures a 401 Unauthorized response for a null or invalid JWT payload.
     */
    it('should return 401 for invalid JWT payload', async () => {
      const invalidPayload = null;
      mockReq.cookies.session = 'invalid.token';
      (mockedJwt.verify as jest.Mock).mockReturnValue(invalidPayload);

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'invalid_token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Ensures a 401 Unauthorized response when the JWT payload lacks the 'sub' field.
     */
    it('should return 401 when JWT payload has no sub field', async () => {
      const payloadWithoutSub = { githubId: 123 };
      mockReq.cookies.session = 'token.without.sub';
      (mockedJwt.verify as jest.Mock).mockReturnValue(payloadWithoutSub);

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'invalid_token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Ensures a 401 Unauthorized response when the user ID in the 'sub' field is not a number.
     */
    it('should return 401 when user ID is not a valid number', async () => {
      const payloadWithInvalidSub = { sub: 'not-a-number' };
      mockReq.cookies.session = 'token.with.invalid.sub';
      (mockedJwt.verify as jest.Mock).mockReturnValue(payloadWithInvalidSub);

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'invalid_token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests failures during user lookup in the database.
   */
  describe('user lookup failures', () => {
    /**
     * Ensures a 401 Unauthorized response when the user specified in the JWT
     * is not found in the database.
     */
    it('should return 401 when user is not found in database', async () => {
      const validPayload = { sub: '999' };
      mockReq.cookies.session = 'valid.token';
      (mockedJwt.verify as jest.Mock).mockReturnValue(validPayload);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'user_not_found' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests specific errors thrown during JWT verification by the 'jsonwebtoken' library.
   */
  describe('JWT verification errors', () => {
    /**
     * Verifies that expired tokens are rejected with a 401 response.
     */
    it('should return 401 for expired tokens', async () => {
      const jwtError = new Error('jwt expired');
      jwtError.name = 'TokenExpiredError';
      mockReq.cookies.session = 'expired.token';
      mockedJwt.verify.mockImplementation(() => {
        throw jwtError;
      });

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Verifies that malformed tokens are rejected with a 401 response.
     */
    it('should return 401 for malformed tokens', async () => {
      const jwtError = new Error('jwt malformed');
      jwtError.name = 'JsonWebTokenError';
      mockReq.cookies.session = 'malformed.token';
      mockedJwt.verify.mockImplementation(() => {
        throw jwtError;
      });

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Verifies that tokens with an invalid signature are rejected with a 401 response.
     */
    it('should return 401 for tokens with invalid signature', async () => {
      const jwtError = new Error('invalid signature');
      jwtError.name = 'JsonWebTokenError';
      mockReq.cookies.session = 'invalid.signature.token';
      mockedJwt.verify.mockImplementation(() => {
        throw jwtError;
      });

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});