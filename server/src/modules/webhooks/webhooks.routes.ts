import {Router} from 'express';
import {asyncHandler} from '../../utils/asyncHandler';
import {verifyGithubSignature} from '../../middleware/webhook.middleware';
import {WebhooksController} from './webhooks.controller';
import {QueueService} from '../../services/queue.service';

export const createWebhooksRouter = (queueService: QueueService): Router => {
  const router = Router();
  const controller = new WebhooksController(queueService);

  // Apply signature verification ONLY to this route.
  router.post('/github', verifyGithubSignature, asyncHandler(controller.handleGithubWebhook));

  return router;
};