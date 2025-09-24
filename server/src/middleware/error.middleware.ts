import {NextFunction, Request, Response} from 'express';
import {logger} from '../utils/logger';

/**
 * Express error handling middleware.
 *
 * Centralizes error logging and shapes the JSON error response sent to clients.
 * Intended to be the last middleware in the chain.
 *
 * @param err The error forwarded from route handlers or other middleware.
 * @param req Express request object.
 * @param res Express response object.
 * @param next Next middleware function (unused but required by Express signature).
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('An unexpected error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Avoid leaking stack traces in production
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
};