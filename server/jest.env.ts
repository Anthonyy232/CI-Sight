// Fixed values so the config module loads without a .env file or real secrets.
Object.assign(process.env, {
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:5173',
  PUBLIC_URL: 'http://localhost:4000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ci_sight_test',
  SESSION_JWT_SECRET: 'test-session-secret-at-least-32-characters',
  TOKEN_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
  GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
  GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
});
