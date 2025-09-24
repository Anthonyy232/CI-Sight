import crypto from 'crypto';
import {NextFunction, Request, Response} from 'express';
import {config} from '../config';
import {logger} from '../utils/logger';

/**
 * Middleware to verify GitHub webhook signatures.
 *
 * Validates the `x-hub-signature-256` header using the configured
 * `GITHUB_WEBHOOK_SECRET`. Requires `req.rawBody` to be preserved by
 * the JSON parser (see `createApp` configuration).
 */
export const verifyGithubSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    logger.warn('Webhook received without signature.');
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  if (!req.rawBody) {
    // This should not happen if the express.json middleware is configured correctly
    logger.error('Server configuration error: rawBody not available for webhook verification.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const hmac = crypto.createHmac('sha256', config.GITHUB_WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(req.rawBody).digest('hex')}`;

  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (signatureBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(signatureBuffer, digestBuffer)) {
    // Use timingSafeEqual to mitigate timing attacks when comparing digests
    logger.warn('Invalid webhook signature received.');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  return next();
};