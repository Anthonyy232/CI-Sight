import {verifyGithubSignature} from '../middleware/webhook.middleware';

// Mock config
jest.mock('../config', () => ({
  config: {
    GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
  },
}));

describe('Webhook Signature Verification', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      headers: {},
      rawBody: Buffer.from('test payload'),
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('valid signature', () => {
    it('should call next() for valid signature', () => {
      // Arrange
      const secret = 'test-webhook-secret';
      const payload = 'test payload';
      const hmac = require('crypto').createHmac('sha256', secret);
      const signature = `sha256=${hmac.update(payload).digest('hex')}`;

      mockReq.headers['x-hub-signature-256'] = signature;

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('missing signature', () => {
    it('should return 401 when signature header is missing', () => {
      // Arrange
      mockReq.headers = {};

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when signature header is empty', () => {
      // Arrange
      mockReq.headers['x-hub-signature-256'] = '';

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('invalid signature', () => {
    it('should return 401 for completely wrong signature', () => {
      // Arrange
      mockReq.headers['x-hub-signature-256'] = 'sha256=wrong-signature';

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for signature with wrong hash', () => {
      // Arrange
      const wrongSecret = 'wrong-secret';
      const hmac = require('crypto').createHmac('sha256', wrongSecret);
      const wrongSignature = `sha256=${hmac.update('test payload').digest('hex')}`;

      mockReq.headers['x-hub-signature-256'] = wrongSignature;

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for signature with wrong algorithm', () => {
      // Arrange
      mockReq.headers['x-hub-signature-256'] = 'sha1=some-hash';

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for malformed signature', () => {
      // Arrange
      mockReq.headers['x-hub-signature-256'] = 'not-a-valid-signature-format';

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('raw body handling', () => {
    it('should return 500 when rawBody is not available', () => {
      // Arrange
      mockReq.rawBody = undefined;
      mockReq.headers['x-hub-signature-256'] = 'sha256=some-signature';

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Server configuration error' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle different payload types', () => {
      // Arrange
      const jsonPayload = JSON.stringify({ action: 'push', repository: { name: 'test' } });
      mockReq.rawBody = Buffer.from(jsonPayload);

      const secret = 'test-webhook-secret';
      const hmac = require('crypto').createHmac('sha256', secret);
      const signature = `sha256=${hmac.update(jsonPayload).digest('hex')}`;

      mockReq.headers['x-hub-signature-256'] = signature;

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('timing attack protection', () => {
    it('should use timing-safe comparison', () => {
      // Arrange
      const crypto = require('crypto');
      const spy = jest.spyOn(crypto, 'timingSafeEqual');

      const secret = 'test-webhook-secret';
      const hmac = crypto.createHmac('sha256', secret);
      const signature = `sha256=${hmac.update('test payload').digest('hex')}`;

      mockReq.headers['x-hub-signature-256'] = signature;

      // Act
      verifyGithubSignature(mockReq, mockRes, mockNext);

      // Assert
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});