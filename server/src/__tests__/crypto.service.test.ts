import {CryptoService} from '../services/crypto.service';
import crypto from 'crypto';
import {logger} from '../utils/logger';

jest.mock('../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  config: {
    TOKEN_ENCRYPTION_KEY: require('./testUtils').TEST_TOKEN_ENCRYPTION_KEY,
  },
}));

/**
 * Test suite for the CryptoService.
 * This suite verifies the core cryptographic operations, including encryption,
 * decryption, error handling, and key derivation logic.
 */
describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    jest.clearAllMocks();
    cryptoService = new CryptoService();
  });

  /**
   * Tests the encryption and decryption round-trip and error handling.
   */
  describe('encrypt and decrypt', () => {
    /**
     * Verifies that a string can be encrypted and then successfully decrypted
     * back to its original value.
     */
    it('should encrypt and decrypt a string correctly', () => {
      const originalText = 'Hello, World!';

      const encrypted = cryptoService.encrypt(originalText);
      const decrypted = cryptoService.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
      expect(encrypted).not.toBe(originalText);
    });

    /**
     * Ensures that attempting to decrypt a malformed (too short) payload
     * returns an empty string and logs a warning.
     */
    it('should return an empty string when decrypting a malformed payload (too short)', () => {
      const malformedPayload = 'short';

      const decrypted = cryptoService.decrypt(malformedPayload);

      expect(decrypted).toBe('');
      expect(logger.warn).toHaveBeenCalledWith('Decrypt failed: payload is too short.');
    });

    /**
     * Verifies that if the underlying crypto library throws an error during decryption,
     * the service catches it, logs a warning, and returns an empty string.
     */
    it('should return an empty string when decryption fails due to an error', () => {
      const invalidPayload = 'this-is-not-a-valid-encrypted-string-and-will-throw-an-error';

      const decrypted = cryptoService.decrypt(invalidPayload);

      expect(decrypted).toBe('');
      expect(logger.warn).toHaveBeenCalledWith('Decrypt failed', expect.any(Object));
    });
  });

  /**
   * Tests the fallback key derivation logic.
   */
  describe('key derivation', () => {
    /**
     * Verifies that if the provided TOKEN_ENCRYPTION_KEY is not in the expected
     * 32-byte base64 format, the service falls back to deriving a key using SHA-256.
     * This test uses `jest.isolateModules` to re-import the service with a modified config.
     */
    it('should derive a key using SHA-256 if the provided key is not a valid 32-byte base64 string', () => {
      jest.isolateModules(() => {
        const badKey = 'this-key-is-not-base64-and-not-32-bytes';
        jest.resetModules();
        jest.doMock('../config', () => ({
          config: { TOKEN_ENCRYPTION_KEY: badKey },
        }));

        const updateSpy = jest.fn().mockReturnThis();
        const digestSpy = jest.fn().mockReturnValue(Buffer.alloc(32));
        const createHashSpy = jest.spyOn(crypto, 'createHash').mockImplementation(
          () =>
            ({
              update: updateSpy,
              digest: digestSpy,
            } as any)
        );

        const { CryptoService: CryptoServiceWithFallback } = require('../services/crypto.service');
        new CryptoServiceWithFallback();

        expect(createHashSpy).toHaveBeenCalledWith('sha256');
        expect(updateSpy).toHaveBeenCalledWith(badKey);
        expect(digestSpy).toHaveBeenCalled();

        createHashSpy.mockRestore();
      });
    });
  });
});