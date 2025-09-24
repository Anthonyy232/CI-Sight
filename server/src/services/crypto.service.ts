import crypto from 'crypto';
import {config} from '../config';
import {logger} from '../utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Symmetric encryption helper for storing tokens/secrets at rest.
 *
 * Uses AES-256-GCM. Encrypted payloads are encoded as base64 of
 * [iv (12 bytes)] + [auth tag (16 bytes)] + [ciphertext].
 */
export class CryptoService {
  private key: Buffer;

  constructor() {
    this.key = this.getKey();
  }

  // Derive or parse a 32-byte key from configured value.
  private getKey(): Buffer {
    const rawKey = config.TOKEN_ENCRYPTION_KEY;
    // A 32-byte key is required for aes-256. Base64 encoding is a good way to store it.
    const keyFromBase64 = Buffer.from(rawKey, 'base64');
    if (keyFromBase64.length === 32) {
      return keyFromBase64;
    }
    // Non-32-byte keys are tolerated by deriving a SHA-256 digest.
    logger.warn('TOKEN_ENCRYPTION_KEY is not a 32-byte base64 string. Deriving key using SHA-256. This is not recommended for production.');
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts UTF-8 text and returns a base64 payload.
   * @param text Plaintext to encrypt.
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Store iv, tag, and encrypted text together, base64 encoded.
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  /**
   * Decrypts a base64 payload produced by `encrypt`.
   * Returns an empty string on failure to avoid throwing in callers.
   */
  decrypt(payloadB64: string): string {
    try {
      const buf = Buffer.from(payloadB64, 'base64');
      if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
        logger.warn('Decrypt failed: payload is too short.');
        return '';
      }

      const iv = buf.slice(0, IV_LENGTH);
      const tag = buf.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = buf.slice(IV_LENGTH + AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error) {
      logger.warn('Decrypt failed', { error: (error as Error).message });
      return '';
    }
  }
}