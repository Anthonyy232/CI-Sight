import {NextFunction, Request, Response} from 'express';

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Helper to wrap async Express handlers.
 *
 * Ensures any rejected promise is forwarded to the central error handler
 * without explicit try/catch in controllers.
 *
 * @param fn The async controller function to execute.
 * @returns An Express-compatible handler that forwards errors to `next`.
 */
export const asyncHandler = (fn: AsyncFunction) => (req: Request, res: Response, next: NextFunction) => {
  // Resolve the promise and forward errors to Express' error pipeline
  Promise.resolve(fn(req, res, next)).catch(next);
};