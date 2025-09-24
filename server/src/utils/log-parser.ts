/**
 * Extracts a contextual "window" of log lines around a specific error signature.
 * This prevents overwhelming the LLM with irrelevant data from large log files.
 * @param fullLogText The complete log content as a single string.
 * @param errorSignature The specific error line to locate.
 * @param windowSize The number of lines to include before and after the error line.
 * @returns A string containing the contextual log snippet.
 */
export function extractErrorContext(
  fullLogText: string,
  errorSignature: string,
  windowSize: number = 10
): string {
  const lines = fullLogText.split('\n');
  const errorLineIndex = lines.findIndex(line => line.includes(errorSignature));

  // If the signature isn't found, fallback to the last part of the log.
  if (errorLineIndex === -1) {
    return lines.slice(-windowSize * 2).join('\n');
  }

  // Clamp the slice indices to prevent out-of-bounds errors.
  const startIndex = Math.max(0, errorLineIndex - windowSize);
  const endIndex = Math.min(lines.length, errorLineIndex + windowSize + 1);

  return lines.slice(startIndex, endIndex).join('\n');
}

/**
 * Sanitizes a log snippet to remove noise and mitigate security risks.
 * This is a critical step before sending potentially user-controlled data to an LLM.
 * @param logContext The log snippet to be cleaned.
 * @returns A sanitized version of the log snippet.
 */
export function sanitizeForLlm(logContext: string): string {
  let sanitized = logContext;

  // Strip ANSI escape codes to remove color/formatting noise.
  sanitized = sanitized.replace(/\x1b\[[0-9;]*[mGKH]/g, '');

  // Redact patterns that resemble secrets, keys, or tokens.
  const secretPatterns = [
    /([a-zA-Z0-9_]*(?:key|token|secret|password)[a-zA-Z0-9_]*\s*[:=]\s*)['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    /(sk|pk)_[a-zA-Z0-9]{20,}/g, // Common pattern for Stripe-like keys
  ];

  secretPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '$1[REDACTED]');
  });

  return sanitized;
}