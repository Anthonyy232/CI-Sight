import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import {errorHandler} from './middleware/error.middleware';
import {logger} from './utils/logger';
import {config} from './config';

// Routers
import {createAuthRouter} from './modules/auth/auth.routes';
import {createWebhooksRouter} from './modules/webhooks/webhooks.routes';
import {createReposRouter} from './modules/repos/repos.routes';
import {createBuildsRouter} from './modules/builds/builds.routes';
import {createProjectsRouter} from './modules/projects/projects.routes';
import {createDevRouter} from './modules/dev/dev.routes';

// Services
import {CryptoService} from './services/crypto.service';
import {QueueService} from './services/queue.service';
import {GithubService} from './services/github.service';

/**
 * Create and configure the Express application.
 *
 * This sets up security, parsing, service initialization, and all API
 * routes. The returned app is ready to be passed to an HTTP server.
 *
 * @returns {Promise<import('express').Application>} Promise that resolves to the configured Express app.
 */
export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // --- Core Middleware ---
  app.use(helmet());
  app.use(cookieParser());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    })
  );
  // This middleware is crucial for webhook signature verification.
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        // Preserve raw request body for webhook signature verification.
        req.rawBody = buf;
      },
    })
  );

  // --- Instantiate Services ---
  const cryptoService = new CryptoService();
  const queueService = new QueueService();
  const githubService = new GithubService();

  // Initialize services that require external connections (Redis, etc.).
  // We await here to preserve previous startup behavior for server.ts while
  // keeping the constructor side-effect free for tests.
  await queueService.init();

  // Attach services to app for cleanup
  app.locals.queueService = queueService;

  // --- API Routes ---
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', createAuthRouter(cryptoService, githubService));
  app.use('/api/webhooks', createWebhooksRouter(queueService));
  app.use('/api', createReposRouter(cryptoService, githubService));
  app.use('/api', createBuildsRouter());
  app.use('/api', createProjectsRouter());

  if (config.NODE_ENV === 'development') {
    app.use('/api/dev', createDevRouter());
  }

  // --- Static Assets & Frontend ---
  if (config.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDistPath));
    // SPA fallback: serve index.html for any non-API GET requests.
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(clientDistPath, 'index.html'));
      } else {
        res.status(404).json({ error: 'Not Found' });
      }
    });
  }

  // --- Error Handling ---
  app.use(errorHandler);

  logger.info('Application setup complete.');
  return app;
}