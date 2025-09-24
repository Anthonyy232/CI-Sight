import dotenv from 'dotenv';
import path from 'path';
import {z} from 'zod';

// Load .env from project root; tests can override process.env as needed.
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Runtime configuration validated and coerced by Zod.
 *
 * Using a schema early helps fail fast on invalid deployments and provides
 * a single source of truth for expected environment variables.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL for your frontend'),
  PUBLIC_URL: z.string().url('PUBLIC_URL must be the publicly accessible URL for your backend'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),

  USE_REDIS: z.string().transform(val => val === 'true').default(false),
  REDIS_URL: z.string().url().optional(),

  SESSION_JWT_SECRET: z.string().min(32, 'SESSION_JWT_SECRET must be at least 32 characters long'),
  TOKEN_ENCRYPTION_KEY: z.string().min(32, 'TOKEN_ENCRYPTION_KEY must be a strong, 32-byte base64 key'),
  GITHUB_WEBHOOK_SECRET: z.string().min(16, 'GITHUB_WEBHOOK_SECRET must be a strong secret'),

  GITHUB_OAUTH_CLIENT_ID: z.string().min(1, 'GITHUB_OAUTH_CLIENT_ID is required'),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1, 'GITHUB_OAUTH_CLIENT_SECRET is required'),

  OLLAMA_API_URL: z.string().url().default('http://localhost:11434/api/generate'),
  OLLAMA_MODEL: z.string().default('codellama:7b'),

  DEV_SEED: z.string().transform(val => val === 'true').default(false),
  PYTHON_EXECUTABLE: z.string().default('python3'),
});

// Parse and export validated config; this throws on invalid or missing vars.
export const config = envSchema.parse(process.env);