/**
 * Provides shared constants and utilities for the test suite.
 */

/**
 * A consistent, valid base64-encoded 32-byte key for use in cryptographic tests.
 * This ensures that tests for services dependent on `CryptoService` can be
 * initialized without errors.
 */
export const TEST_TOKEN_ENCRYPTION_KEY = 'dGVzdGtleWZvcmVuY3J5cHRpb250ZXN0aW5nMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=';

export default {
  TEST_TOKEN_ENCRYPTION_KEY,
};