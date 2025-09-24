// src/__tests__/crypto.service.test.ts

import {CryptoService} from '../services/crypto.service';
import crypto from 'crypto';
import {logger} from '../utils/logger';

// Mock the logger to prevent console noise during tests
jest.mock('../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

// Mock config for standard tests
// Avoid referencing imported bindings inside the jest.mock factory at module
// initialization time to prevent hoisting/initialization order problems.
jest.mock('../config', () => ({
  config: {
    TOKEN_ENCRYPTION_KEY: require('./testUtils').TEST_TOKEN_ENCRYPTION_KEY,
  },
}));

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    jest.clearAllMocks();
    cryptoService = new CryptoService();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      // Arrange
      const originalText = 'Hello, World!';

      // Act
      const encrypted = cryptoService.encrypt(originalText);
      const decrypted = cryptoService.decrypt(encrypted);

      // Assert
      expect(decrypted).toBe(originalText);
      expect(encrypted).not.toBe(originalText);
    });

    it('should return an empty string when decrypting a malformed payload (too short)', () => {
      // Arrange
      const malformedPayload = 'short';

      // Act
      const decrypted = cryptoService.decrypt(malformedPayload);

      // Assert
      expect(decrypted).toBe('');
      expect(logger.warn).toHaveBeenCalledWith('Decrypt failed: payload is too short.');
    });

    it('should return an empty string when decryption fails due to an error', () => {
      // Arrange
      const invalidPayload = 'this-is-not-a-valid-encrypted-string-and-will-throw-an-error';

      // Act
      const decrypted = cryptoService.decrypt(invalidPayload);

      // Assert
      expect(decrypted).toBe('');
      expect(logger.warn).toHaveBeenCalledWith('Decrypt failed', expect.any(Object));
    });
  });

  describe('key derivation', () => {
    it('should derive a key using SHA-256 if the provided key is not a valid 32-byte base64 string', () => {
      // Use isolateModules to ensure we get a fresh instance of the service with our new mock
      jest.isolateModules(() => {
          // Arrange
          const badKey = 'this-key-is-not-base64-and-not-32-bytes';
          // Reset module registry so our doMock takes effect for this isolated run
          jest.resetModules();
          // Use doMock here so we only override the config for this isolated module run
          jest.doMock('../config', () => ({
            config: { TOKEN_ENCRYPTION_KEY: badKey },
          }));

        // Spy on the crypto module to verify behavior
        const updateSpy = jest.fn().mockReturnThis(); // FIX: Return `this` to allow chaining
        const digestSpy = jest.fn().mockReturnValue(Buffer.alloc(32)); // Return a buffer to satisfy constructor
        const createHashSpy = jest.spyOn(crypto, 'createHash').mockImplementation(
          () =>
            ({
              update: updateSpy,
              digest: digestSpy,
            } as any)
        );

        // Act
        // We must require the module *inside* isolateModules to get the version with the new mock
  const { CryptoService: CryptoServiceWithFallback } = require('../services/crypto.service');
        new CryptoServiceWithFallback();

        // Assert
        expect(createHashSpy).toHaveBeenCalledWith('sha256');
        expect(updateSpy).toHaveBeenCalledWith(badKey);
        expect(digestSpy).toHaveBeenCalled();

        // Cleanup
        createHashSpy.mockRestore();
      });
    });
  });
});