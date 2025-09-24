import {Router} from 'express';
import {asyncHandler} from '../../utils/asyncHandler';
import {BuildsController} from './builds.controller';
import {BuildsService} from './builds.service';

export const createBuildsRouter = (): Router => {
  const router = Router();
  const buildsService = new BuildsService();
  const controller = new BuildsController(buildsService);

  // Public endpoints for build metadata and analytics
  router.get('/builds', asyncHandler(controller.listRecentBuilds));
  router.get('/builds/:id', asyncHandler(controller.getBuildById));
  router.get('/builds/analytics/errors', asyncHandler(controller.getErrorAnalytics));

  return router;
};