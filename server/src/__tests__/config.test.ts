import {config} from '../config';

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

const originalEnv = process.env;

/**
 * Test suite for application configuration validation.
 * This suite verifies that the configuration module correctly parses, validates,
 * and provides default values for environment variables. It uses `jest.resetModules`
 * to force the config module to be re-evaluated for each test case.
 */
describe('Config Validation', () => {
  beforeEach(() => {
    process.env = {};
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /**
   * Tests the successful parsing of a complete and valid set of environment variables.
   */
  describe('successful parsing with valid environment variables', () => {
    /**
     * Verifies that all required and optional environment variables are parsed correctly.
     */
    it('should parse all required environment variables successfully', () => {
      process.env = {
        NODE_ENV: 'development',
        PORT: '4000',
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        USE_REDIS: 'false',
        REDIS_URL: 'redis://localhost:6379',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
        OLLAMA_API_URL: 'http://localhost:11434/api/generate',
        OLLAMA_MODEL: 'codellama:7b',
        DEV_SEED: 'false',
        PYTHON_EXECUTABLE: 'python3',
      };

      const { config: freshConfig } = require('../config');

      expect(freshConfig.NODE_ENV).toBe('development');
      expect(freshConfig.PORT).toBe(4000);
      expect(freshConfig.FRONTEND_URL).toBe('http://localhost:3000');
      expect(freshConfig.PUBLIC_URL).toBe('http://localhost:4000');
      expect(freshConfig.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
      expect(freshConfig.USE_REDIS).toBe(false);
      expect(freshConfig.REDIS_URL).toBe('redis://localhost:6379');
      expect(freshConfig.SESSION_JWT_SECRET).toBe('a'.repeat(32));
      expect(freshConfig.TOKEN_ENCRYPTION_KEY).toBe('b'.repeat(32));
      expect(freshConfig.GITHUB_WEBHOOK_SECRET).toBe('c'.repeat(16));
      expect(freshConfig.GITHUB_OAUTH_CLIENT_ID).toBe('test-client-id');
      expect(freshConfig.GITHUB_OAUTH_CLIENT_SECRET).toBe('test-client-secret');
      expect(freshConfig.OLLAMA_API_URL).toBe('http://localhost:11434/api/generate');
      expect(freshConfig.OLLAMA_MODEL).toBe('codellama:7b');
      expect(freshConfig.DEV_SEED).toBe(false);
      expect(freshConfig.PYTHON_EXECUTABLE).toBe('python3');
    });

    /**
     * Verifies that default values are applied correctly when optional variables are omitted.
     */
    it('should use default values when optional variables are not provided', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      const { config: freshConfig } = require('../config');

      expect(freshConfig.NODE_ENV).toBe('development');
      expect(freshConfig.PORT).toBe(4000);
      expect(freshConfig.USE_REDIS).toBe(false);
      expect(freshConfig.OLLAMA_API_URL).toBe('http://localhost:11434/api/generate');
      expect(freshConfig.OLLAMA_MODEL).toBe('codellama:7b');
      expect(freshConfig.DEV_SEED).toBe(false);
      expect(freshConfig.PYTHON_EXECUTABLE).toBe('python3');
    });

    /**
     * Verifies that string values from `process.env` are correctly coerced into
     * numbers and booleans where appropriate.
     */
    it('should handle type coercion correctly', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
        PORT: '3000',
        USE_REDIS: 'true',
        DEV_SEED: 'true',
      };

      const { config: freshConfig } = require('../config');

      expect(freshConfig.PORT).toBe(3000);
      expect(typeof freshConfig.PORT).toBe('number');
      expect(freshConfig.USE_REDIS).toBe(true);
      expect(typeof freshConfig.USE_REDIS).toBe('boolean');
      expect(freshConfig.DEV_SEED).toBe(true);
      expect(typeof freshConfig.DEV_SEED).toBe('boolean');
    });
  });

  /**
   * Verifies that the application fails to start if required variables are missing.
   */
  describe('error handling for missing required variables', () => {
    it('should throw error when FRONTEND_URL is missing', () => {
      process.env = {
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).toThrow(/FRONTEND_URL/);
    });

    it('should throw error when PUBLIC_URL is missing', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).toThrow(/PUBLIC_URL/);
    });

    it('should throw error when DATABASE_URL is missing', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).toThrow(/DATABASE_URL/);
    });

    it('should throw error when SESSION_JWT_SECRET is missing', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).toThrow(/SESSION_JWT_SECRET/);
    });

    it('should throw error when TOKEN_ENCRYPTION_KEY is missing', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).toThrow(/TOKEN_ENCRYPTION_KEY/);
    });

    it('should throw error when GITHUB_WEBHOOK_SECRET is missing', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).toThrow(/GITHUB_WEBHOOK_SECRET/);
    });

    it('should throw error when GITHUB_OAUTH_CLIENT_ID is missing', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).toThrow(/GITHUB_OAUTH_CLIENT_ID/);
    });

    it('should throw error when GITHUB_OAUTH_CLIENT_SECRET is missing', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
      };
      expect(() => require('../config')).toThrow(/GITHUB_OAUTH_CLIENT_SECRET/);
    });
  });

  /**
   * Verifies that specific validation rules (e.g., URL format, secret length) are enforced.
   */
  describe('error handling for invalid values', () => {
    const baseValidEnv = {
      FRONTEND_URL: 'http://localhost:3000',
      PUBLIC_URL: 'http://localhost:4000',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      SESSION_JWT_SECRET: 'a'.repeat(32),
      TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
      GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
      GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
      GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
    };

    it('should throw error for invalid NODE_ENV', () => {
      process.env = { ...baseValidEnv, NODE_ENV: 'invalid-env' };
      expect(() => require('../config')).toThrow();
    });

    it('should throw error for invalid FRONTEND_URL', () => {
      process.env = { ...baseValidEnv, FRONTEND_URL: 'not-a-url' };
      expect(() => require('../config')).toThrow('FRONTEND_URL must be a valid URL for your frontend');
    });

    it('should throw error for invalid PUBLIC_URL', () => {
      process.env = { ...baseValidEnv, PUBLIC_URL: 'not-a-url' };
      expect(() => require('../config')).toThrow('PUBLIC_URL must be the publicly accessible URL for your backend');
    });

    it('should throw error for invalid DATABASE_URL', () => {
      process.env = { ...baseValidEnv, DATABASE_URL: 'not-a-url' };
      expect(() => require('../config')).toThrow('DATABASE_URL must be a valid PostgreSQL connection URL');
    });

    it('should throw error for SESSION_JWT_SECRET too short', () => {
      process.env = { ...baseValidEnv, SESSION_JWT_SECRET: 'short' };
      expect(() => require('../config')).toThrow('SESSION_JWT_SECRET must be at least 32 characters long');
    });

    it('should throw error for TOKEN_ENCRYPTION_KEY too short', () => {
      process.env = { ...baseValidEnv, TOKEN_ENCRYPTION_KEY: 'short' };
      expect(() => require('../config')).toThrow('TOKEN_ENCRYPTION_KEY must be a strong, 32-byte base64 key');
    });

    it('should throw error for GITHUB_WEBHOOK_SECRET too short', () => {
      process.env = { ...baseValidEnv, GITHUB_WEBHOOK_SECRET: 'short' };
      expect(() => require('../config')).toThrow('GITHUB_WEBHOOK_SECRET must be a strong secret');
    });

    it('should throw error for empty GITHUB_OAUTH_CLIENT_ID', () => {
      process.env = { ...baseValidEnv, GITHUB_OAUTH_CLIENT_ID: '' };
      expect(() => require('../config')).toThrow('GITHUB_OAUTH_CLIENT_ID is required');
    });

    it('should throw error for empty GITHUB_OAUTH_CLIENT_SECRET', () => {
      process.env = { ...baseValidEnv, GITHUB_OAUTH_CLIENT_SECRET: '' };
      expect(() => require('../config')).toThrow('GITHUB_OAUTH_CLIENT_SECRET is required');
    });

    it('should throw error for invalid OLLAMA_API_URL', () => {
      process.env = { ...baseValidEnv, OLLAMA_API_URL: 'not-a-url' };
      expect(() => require('../config')).toThrow();
    });

    it('should throw error for invalid REDIS_URL when USE_REDIS is true', () => {
      process.env = { ...baseValidEnv, USE_REDIS: 'true', REDIS_URL: 'not-a-url' };
      expect(() => require('../config')).toThrow();
    });
  });

  /**
   * Verifies conditional validation logic, such as for Redis configuration.
   */
  describe('optional variables', () => {
    it('should allow REDIS_URL to be optional when USE_REDIS is false', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        USE_REDIS: 'false',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).not.toThrow();
    });

    it('should require REDIS_URL when USE_REDIS is true', () => {
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        USE_REDIS: 'true',
        REDIS_URL: 'redis://localhost:6379',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };
      expect(() => require('../config')).not.toThrow();
    });
  });
});