import {authMiddleware} from '../middleware/auth.middleware';
import {prisma} from '../db';
import jwt from 'jsonwebtoken';

// Mock dependencies
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

  describe('successful authentication', () => {
    it('should authenticate valid JWT token and attach user to request', async () => {
      // Arrange
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

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
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

  describe('missing token', () => {
    it('should return 401 when no session cookie is present', async () => {
      // Arrange
      mockReq.cookies = {};

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when session cookie is undefined', async () => {
      // Arrange
      mockReq.cookies.session = undefined;

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('invalid JWT', () => {
    it('should return 401 for invalid JWT payload', async () => {
      // Arrange
      const invalidPayload = null;
      mockReq.cookies.session = 'invalid.token';
      (mockedJwt.verify as jest.Mock).mockReturnValue(invalidPayload);

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'invalid_token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when JWT payload has no sub field', async () => {
      // Arrange
      const payloadWithoutSub = { githubId: 123 };
      mockReq.cookies.session = 'token.without.sub';
      (mockedJwt.verify as jest.Mock).mockReturnValue(payloadWithoutSub);

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'invalid_token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user ID is not a valid number', async () => {
      // Arrange
      const payloadWithInvalidSub = { sub: 'not-a-number' };
      mockReq.cookies.session = 'token.with.invalid.sub';
      (mockedJwt.verify as jest.Mock).mockReturnValue(payloadWithInvalidSub);

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'invalid_token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('user lookup failures', () => {
    it('should return 401 when user is not found in database', async () => {
      // Arrange
      const validPayload = { sub: '999' };
      mockReq.cookies.session = 'valid.token';
      (mockedJwt.verify as jest.Mock).mockReturnValue(validPayload);
      (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'user_not_found' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('JWT verification errors', () => {
    it('should return 401 for expired tokens', async () => {
      // Arrange
      const jwtError = new Error('jwt expired');
      jwtError.name = 'TokenExpiredError';
      mockReq.cookies.session = 'expired.token';
      mockedJwt.verify.mockImplementation(() => {
        throw jwtError;
      });

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for malformed tokens', async () => {
      // Arrange
      const jwtError = new Error('jwt malformed');
      jwtError.name = 'JsonWebTokenError';
      mockReq.cookies.session = 'malformed.token';
      mockedJwt.verify.mockImplementation(() => {
        throw jwtError;
      });

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for tokens with invalid signature', async () => {
      // Arrange
      const jwtError = new Error('invalid signature');
      jwtError.name = 'JsonWebTokenError';
      mockReq.cookies.session = 'invalid.signature.token';
      mockedJwt.verify.mockImplementation(() => {
        throw jwtError;
      });

      // Act
      await authMiddleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});