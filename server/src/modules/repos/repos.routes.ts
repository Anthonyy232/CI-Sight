import {Router} from 'express';
import {asyncHandler} from '../../utils/asyncHandler';
import {authMiddleware} from '../../middleware/auth.middleware';
import {ReposController} from './repos.controller';
import {ReposService} from './repos.service';
import {CryptoService} from '../../services/crypto.service';
import {GithubService} from '../../services/github.service';

export const createReposRouter = (cryptoService: CryptoService, githubService: GithubService): Router => {
  const router = Router();
  const reposService = new ReposService(cryptoService, githubService);
  const controller = new ReposController(reposService);

  // All routes in this module require authentication
  router.use(authMiddleware);

  router.get('/github/repos', asyncHandler(controller.listUserGithubRepos));
  router.get('/my/repos', asyncHandler(controller.listLinkedRepos));
  router.post('/repos/:projectId/register', asyncHandler(controller.registerRepo));
  router.delete('/repos/:id', asyncHandler(controller.deleteRepoLink));
  router.post('/repos/:id/restore', asyncHandler(controller.restoreRepoLink));

  return router;
};