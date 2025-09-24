import {Router} from 'express';
import {asyncHandler} from '../../utils/asyncHandler';
import {DevController} from './dev.controller';

/**
 * Dev-only routes.
 *
 * Why: Provides a simple HTTP entrypoint to run development utilities such as
 * seeding the database. These routes are intentionally separated so the main
 * application can exclude them in production builds.
 *
 * Note: Each handler is still responsible for checking `config.DEV_SEED` to
 * prevent accidental execution in non-dev environments.
 */
export const createDevRouter = (): Router => {
  const router = Router();
  const controller = new DevController();

  // Exposes POST /dev/seed which calls into the controller's seeding logic.
  router.post('/seed', asyncHandler(controller.seedDatabase));

  return router;
};