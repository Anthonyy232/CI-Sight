import {createApp} from './app';
import {config} from './config';
import {logger} from './utils/logger';

/**
 * Server bootstrapper.
 *
 * Responsible for creating the app, starting the HTTP server, and wiring
 * graceful shutdown handlers to clean up background resources (e.g., queue).
 */
(async () => {
  const app = await createApp();

  const server = app.listen(config.PORT, () => {
    logger.info(`Server listening on http://localhost:${config.PORT} in ${config.NODE_ENV} mode`);
  });

  // Graceful shutdown for SIGINT/SIGTERM to avoid abrupt process exit and
  // allow background workers and DB connections to close cleanly.
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, shutting down gracefully.`);
      server.close(async () => {
        logger.info('Server closed.');
        // Cleanup services
        await app.locals.queueService?.cleanup();
        process.exit(0);
      });
    });
  });
})();