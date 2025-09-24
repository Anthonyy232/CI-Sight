import {config} from '../config';

// Mock dotenv to prevent loading actual .env file
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock process.env
const originalEnv = process.env;

describe('Config Validation', () => {
  beforeEach(() => {
    // Reset process.env before each test
    process.env = {};
    // Clear the module cache to force re-import
    jest.resetModules();
  });

  afterAll(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  describe('successful parsing with valid environment variables', () => {
    it('should parse all required environment variables successfully', () => {
      // Arrange
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

      // Act & Assert - re-import to get fresh config
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

    it('should use default values when optional variables are not provided', () => {
      // Arrange
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

      // Act & Assert
      const { config: freshConfig } = require('../config');

      expect(freshConfig.NODE_ENV).toBe('development');
      expect(freshConfig.PORT).toBe(4000);
      expect(freshConfig.USE_REDIS).toBe(false);
      expect(freshConfig.OLLAMA_API_URL).toBe('http://localhost:11434/api/generate');
      expect(freshConfig.OLLAMA_MODEL).toBe('codellama:7b');
      expect(freshConfig.DEV_SEED).toBe(false);
      expect(freshConfig.PYTHON_EXECUTABLE).toBe('python3');
    });

    it('should handle type coercion correctly', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
        PORT: '3000', // String that should be coerced to number
        USE_REDIS: 'true', // String that should be coerced to boolean
        DEV_SEED: 'true', // String that should be coerced to boolean
      };

      // Act & Assert
      const { config: freshConfig } = require('../config');

      expect(freshConfig.PORT).toBe(3000);
      expect(typeof freshConfig.PORT).toBe('number');
      expect(freshConfig.USE_REDIS).toBe(true);
      expect(typeof freshConfig.USE_REDIS).toBe('boolean');
      expect(freshConfig.DEV_SEED).toBe(true);
      expect(typeof freshConfig.DEV_SEED).toBe('boolean');
    });
  });

  describe('error handling for missing required variables', () => {
    it('should throw error when FRONTEND_URL is missing', () => {
      // Arrange
      process.env = {
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow(/FRONTEND_URL/);
    });

    it('should throw error when PUBLIC_URL is missing', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow(/PUBLIC_URL/);
    });

    it('should throw error when DATABASE_URL is missing', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow(/DATABASE_URL/);
    });

    it('should throw error when SESSION_JWT_SECRET is missing', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow(/SESSION_JWT_SECRET/);
    });

    it('should throw error when TOKEN_ENCRYPTION_KEY is missing', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow(/TOKEN_ENCRYPTION_KEY/);
    });

    it('should throw error when GITHUB_WEBHOOK_SECRET is missing', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow(/GITHUB_WEBHOOK_SECRET/);
    });

    it('should throw error when GITHUB_OAUTH_CLIENT_ID is missing', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow(/GITHUB_OAUTH_CLIENT_ID/);
    });

    it('should throw error when GITHUB_OAUTH_CLIENT_SECRET is missing', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow(/GITHUB_OAUTH_CLIENT_SECRET/);
    });
  });

  describe('error handling for invalid values', () => {
    it('should throw error for invalid NODE_ENV', () => {
      // Arrange
      process.env = {
        NODE_ENV: 'invalid-env',
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow();
    });

    it('should throw error for invalid FRONTEND_URL', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'not-a-url',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow('FRONTEND_URL must be a valid URL for your frontend');
    });

    it('should throw error for invalid PUBLIC_URL', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'not-a-url',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow('PUBLIC_URL must be the publicly accessible URL for your backend');
    });

    it('should throw error for invalid DATABASE_URL', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'not-a-url',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow('DATABASE_URL must be a valid PostgreSQL connection URL');
    });

    it('should throw error for SESSION_JWT_SECRET too short', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'short',
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow('SESSION_JWT_SECRET must be at least 32 characters long');
    });

    it('should throw error for TOKEN_ENCRYPTION_KEY too short', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'short',
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow('TOKEN_ENCRYPTION_KEY must be a strong, 32-byte base64 key');
    });

    it('should throw error for GITHUB_WEBHOOK_SECRET too short', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'short',
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow('GITHUB_WEBHOOK_SECRET must be a strong secret');
    });

    it('should throw error for empty GITHUB_OAUTH_CLIENT_ID', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: '',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow('GITHUB_OAUTH_CLIENT_ID is required');
    });

    it('should throw error for empty GITHUB_OAUTH_CLIENT_SECRET', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: '',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow('GITHUB_OAUTH_CLIENT_SECRET is required');
    });

    it('should throw error for invalid OLLAMA_API_URL', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
        OLLAMA_API_URL: 'not-a-url',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow();
    });

    it('should throw error for invalid REDIS_URL when USE_REDIS is true', () => {
      // Arrange
      process.env = {
        FRONTEND_URL: 'http://localhost:3000',
        PUBLIC_URL: 'http://localhost:4000',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        USE_REDIS: 'true',
        REDIS_URL: 'not-a-url',
        SESSION_JWT_SECRET: 'a'.repeat(32),
        TOKEN_ENCRYPTION_KEY: 'b'.repeat(32),
        GITHUB_WEBHOOK_SECRET: 'c'.repeat(16),
        GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
        GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
      };

      // Act & Assert
      expect(() => {
        require('../config');
      }).toThrow();
    });
  });

  describe('optional variables', () => {
    it('should allow REDIS_URL to be optional when USE_REDIS is false', () => {
      // Arrange
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

      // Act & Assert
      expect(() => {
        require('../config');
      }).not.toThrow();
    });

    it('should require REDIS_URL when USE_REDIS is true', () => {
      // Arrange
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

      // Act & Assert
      expect(() => {
        require('../config');
      }).not.toThrow();
    });
  });
});