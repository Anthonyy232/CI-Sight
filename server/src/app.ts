import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import {errorHandler} from './middleware/error.middleware';
import {logger} from './utils/logger';
import {config} from './config';

import {createAuthRouter} from './modules/auth/auth.routes';
import {createWebhooksRouter} from './modules/webhooks/webhooks.routes';
import {createReposRouter} from './modules/repos/repos.routes';
import {createBuildsRouter} from './modules/builds/builds.routes';
import {createProjectsRouter} from './modules/projects/projects.routes';
import {createDevRouter} from './modules/dev/dev.routes';

import {CryptoService} from './services/crypto.service';
import {QueueService} from './services/queue.service';
import {GithubService} from './services/github.service';

export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        // Raw body for webhook signature checks.
        req.rawBody = buf;
      },
    })
  );

  const cryptoService = new CryptoService();
  const queueService = new QueueService();
  const githubService = new GithubService();

  await queueService.init();

  app.locals.queueService = queueService;

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', createAuthRouter(cryptoService, githubService));
  app.use('/api/webhooks', createWebhooksRouter(queueService));
  app.use('/api', createReposRouter(cryptoService, githubService));
  app.use('/api', createBuildsRouter());
  app.use('/api', createProjectsRouter());

  if (config.NODE_ENV === 'development') {
    app.use('/api/dev', createDevRouter());
  }

  if (config.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDistPath));
    app.get('/{*splat}', (req, res) => {
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(clientDistPath, 'index.html'));
      } else {
        res.status(404).json({ error: 'Not Found' });
      }
    });
  }

  app.use(errorHandler);

  logger.info('Application setup complete.');
  return app;
}