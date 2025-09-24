import {Router} from 'express';
import {asyncHandler} from '../../utils/asyncHandler';
import {ProjectsController} from './projects.controller';
import {ProjectsService} from './projects.service';
import {ReposService} from '../repos/repos.service';
import {CryptoService} from '../../services/crypto.service';
import {GithubService} from '../../services/github.service';
import {authMiddleware} from '../../middleware/auth.middleware';

export const createProjectsRouter = (): Router => {
  const router = Router();
  const cryptoService = new CryptoService();
  const githubService = new GithubService();
  const reposService = new ReposService(cryptoService, githubService);
  const projectsService = new ProjectsService(cryptoService, githubService);
  const controller = new ProjectsController(projectsService, reposService);

  // All project routes require authentication
  router.use('/projects', authMiddleware);

  router.get('/projects', asyncHandler(controller.listAllProjects));
  router.post('/projects', asyncHandler(controller.createProject));
  router.get('/projects/:id', asyncHandler(controller.getProject));
  router.delete('/projects/:id', asyncHandler(controller.deleteProject));
  router.get('/projects/:id/builds', asyncHandler(controller.listProjectBuilds));

  return router;
};