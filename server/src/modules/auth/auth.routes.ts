import {Router} from 'express';
import {asyncHandler} from '../../utils/asyncHandler';
import {authMiddleware} from '../../middleware/auth.middleware';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {CryptoService} from '../../services/crypto.service';
import {GithubService} from '../../services/github.service';

export const createAuthRouter = (cryptoService: CryptoService, githubService: GithubService): Router => {
  const router = Router();
  const authService = new AuthService(cryptoService, githubService);
  const controller = new AuthController(authService);

  router.get('/github', controller.githubLogin);
  router.get('/github/callback', asyncHandler(controller.githubCallback));
  router.post('/logout', controller.logout);
  router.get('/me', authMiddleware, asyncHandler(controller.getCurrentUser));
  router.post('/pat', authMiddleware, asyncHandler(controller.updateGithubPat));

  return router;
};