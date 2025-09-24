/**
 * Represents a minimal authenticated user attached to `req.user` by auth middleware.
 * - `accessToken` is stored encrypted in the DB and decrypted on demand.
 */
export interface AuthenticatedUser {
  id: number;
  login: string;
  accessToken: string; // The encrypted OAuth token from the DB
}

declare global {
  namespace Express {
    export interface Request {
      /** Populated by `auth.middleware` after successful JWT verification. */
      user?: AuthenticatedUser;
      /** Preserved raw body buffer used for webhook signature verification. */
      rawBody?: Buffer;
    }
  }
}