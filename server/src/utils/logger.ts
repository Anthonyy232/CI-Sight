/**
 * Minimal logger abstraction used across the server.
 *
 * Kept intentionally simple for this project; swap with a structured
 * logger if/when more advanced features (files, levels, JSON) are needed.
 */
export const logger = {
  // General informational messages
  info: (...args: any[]) => console.log(`[INFO]`, ...args),
  // Non-fatal warnings
  warn: (...args: any[]) => console.warn(`[WARN]`, ...args),
  // Errors that should be investigated
  error: (...args: any[]) => console.error(`[ERROR]`, ...args),
};