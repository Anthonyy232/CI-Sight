import {verifyGithubSignature} from '../middleware/webhook.middleware';

jest.mock('../config', () => ({
  config: {
    GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
  },
}));

/**
 * Test suite for the GitHub webhook signature verification middleware.
 * This suite ensures that incoming webhooks are properly authenticated and that
 * invalid or missing signatures are correctly rejected.
 */
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

  /**
   * Tests the successful validation of a correct signature.
   */
  describe('valid signature', () => {
    /**
     * Verifies that a request with a valid `x-hub-signature-256` header
     * is passed to the next middleware.
     */
    it('should call next() for valid signature', () => {
      const secret = 'test-webhook-secret';
      const payload = 'test payload';
      const hmac = require('crypto').createHmac('sha256', secret);
      const signature = `sha256=${hmac.update(payload).digest('hex')}`;
      mockReq.headers['x-hub-signature-256'] = signature;

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests scenarios where the signature header is missing.
   */
  describe('missing signature', () => {
    /**
     * Ensures a 401 Unauthorized response when the signature header is not present.
     */
    it('should return 401 when signature header is missing', () => {
      mockReq.headers = {};

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Ensures a 401 Unauthorized response when the signature header is present but empty.
     */
    it('should return 401 when signature header is empty', () => {
      mockReq.headers['x-hub-signature-256'] = '';

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests scenarios with various forms of invalid signatures.
   */
  describe('invalid signature', () => {
    /**
     * Verifies rejection of a signature that is syntactically correct but has the wrong value.
     */
    it('should return 401 for completely wrong signature', () => {
      mockReq.headers['x-hub-signature-256'] = 'sha256=wrong-signature';

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Verifies rejection of a signature computed with the wrong secret.
     */
    it('should return 401 for signature with wrong hash', () => {
      const wrongSecret = 'wrong-secret';
      const hmac = require('crypto').createHmac('sha256', wrongSecret);
      const wrongSignature = `sha256=${hmac.update('test payload').digest('hex')}`;
      mockReq.headers['x-hub-signature-256'] = wrongSignature;

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Verifies rejection of a signature computed with an unsupported algorithm (e.g., sha1).
     */
    it('should return 401 for signature with wrong algorithm', () => {
      mockReq.headers['x-hub-signature-256'] = 'sha1=some-hash';

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Verifies rejection of a signature that does not match the 'algorithm=hash' format.
     */
    it('should return 401 for malformed signature', () => {
      mockReq.headers['x-hub-signature-256'] = 'not-a-valid-signature-format';

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  /**
   * Tests handling of the raw request body.
   */
  describe('raw body handling', () => {
    /**
     * Ensures a 500 server error is returned if the rawBody is not available on the request,
     * which indicates a server misconfiguration (e.g., missing body parser).
     */
    it('should return 500 when rawBody is not available', () => {
      mockReq.rawBody = undefined;
      mockReq.headers['x-hub-signature-256'] = 'sha256=some-signature';

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Server configuration error' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    /**
     * Verifies that the middleware correctly handles different payload types, such as JSON.
     */
    it('should handle different payload types', () => {
      const jsonPayload = JSON.stringify({ action: 'push', repository: { name: 'test' } });
      mockReq.rawBody = Buffer.from(jsonPayload);
      const secret = 'test-webhook-secret';
      const hmac = require('crypto').createHmac('sha256', secret);
      const signature = `sha256=${hmac.update(jsonPayload).digest('hex')}`;
      mockReq.headers['x-hub-signature-256'] = signature;

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  /**
   * Verifies the use of security best practices.
   */
  describe('timing attack protection', () => {
    /**
     * Ensures that `crypto.timingSafeEqual` is used for comparing signatures to
     * mitigate the risk of timing attacks.
     */
    it('should use timing-safe comparison', () => {
      const crypto = require('crypto');
      const spy = jest.spyOn(crypto, 'timingSafeEqual');
      const secret = 'test-webhook-secret';
      const hmac = crypto.createHmac('sha256', secret);
      const signature = `sha256=${hmac.update('test payload').digest('hex')}`;
      mockReq.headers['x-hub-signature-256'] = signature;

      verifyGithubSignature(mockReq, mockRes, mockNext);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});