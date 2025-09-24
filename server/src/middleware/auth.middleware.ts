import {NextFunction, Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import {config} from '../config';
import {prisma} from '../db';
import {logger} from '../utils/logger';

/**
 * Express middleware that validates the session JWT stored in the `session` cookie.
 *
 * Why: Provides a small, centralized piece of auth logic so handlers can assume
 * a minimally populated `req.user` when a request is authenticated.
 *
 * Behaviour: On success attaches `req.user` and calls `next()`. On failure it
 * returns a 401 JSON error and does not call `next()`.
 *
 * @param req Express request (may include cookies)
 * @param res Express response used to send 401 on failures
 * @param next Express next function called when authentication succeeds
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.session;
    if (!token) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    // Verify the JWT using the server's symmetric secret. We cast the payload
    // to JwtPayload because we only expect a small set of claims (e.g., `sub`).
    const payload = jwt.verify(token, config.SESSION_JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    const userId = Number(payload.sub);
    if (isNaN(userId)) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'user_not_found' });
    }

    req.user = {
      id: user.id,
      login: user.login,
      accessToken: user.accessToken,
    };
    // Attach a minimal user object so downstream code can access id/login/token.
    // Note: accessToken remains encrypted in the DB; services should decrypt it
    // per-request and avoid persisting or logging the raw token.
    next();
  } catch (error) {
    // Catches JWT verification errors (e.g., expired, invalid signature)
    logger.warn('Authentication attempt failed', { error });
    return res.status(401).json({ error: 'unauthenticated' });
  }
};