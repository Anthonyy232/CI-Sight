import {asyncHandler} from '../utils/asyncHandler';
import {extractErrorContext, sanitizeForLlm} from '../utils/log-parser';

/**
 * Test suite for the asyncHandler utility.
 * This utility wraps asynchronous Express route handlers to ensure
 * errors are properly caught and passed to the 'next' middleware.
 */
describe('asyncHandler', () => {
  /**
   * Verifies that the wrapped handler is called and completes successfully
   * without calling the 'next' function.
   */
  it('should call the async function and resolve successfully', async () => {
    const mockReq = { body: 'test' };
    const mockRes = { json: jest.fn() };
    const mockNext = jest.fn();
    const mockHandler = jest.fn().mockResolvedValue('success');

    const handler = asyncHandler(mockHandler);
    await handler(mockReq as any, mockRes as any, mockNext);

    expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  /**
   * Verifies that if the wrapped handler throws an error, the error is
   * caught and passed to the 'next' function for global error handling.
   */
  it('should call next with error when async function throws', async () => {
    const mockReq = {};
    const mockRes = {};
    const mockNext = jest.fn();
    const error = new Error('Test error');
    const mockHandler = jest.fn().mockRejectedValue(error);

    const handler = asyncHandler(mockHandler);
    await handler(mockReq as any, mockRes as any, mockNext);

    expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(error);
  });
});

/**
 * Test suite for the `extractErrorContext` utility function.
 * This function is responsible for extracting a relevant snippet of log text
 * surrounding a specific error signature.
 */
describe('extractErrorContext', () => {
  /**
   * Verifies that the function correctly extracts a specified number of lines
   * before and after a found error signature.
   */
  it('should extract context around error signature', () => {
    const logText = `Line 1: Info message
Line 2: Debug info
Line 3: Error: Something went wrong
Line 4: More details
Line 5: Stack trace
Line 6: End of log`;
    const errorSignature = 'Error: Something went wrong';

    const result = extractErrorContext(logText, errorSignature, 2);

    expect(result).toContain('Line 1: Info message');
    expect(result).toContain('Line 5: Stack trace');
    expect(result).not.toContain('Line 6: End of log');
  });

  /**
   * Verifies that if the error signature is not found, the function falls back
   * to returning a snippet from the end of the log file.
   */
  it('should return last lines when error signature not found', () => {
    const logText = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10`;
    const errorSignature = 'Non-existent error';

    const result = extractErrorContext(logText, errorSignature, 3);

    expect(result.split('\n')).toHaveLength(6);
    expect(result).toContain('Line 5');
    expect(result).toContain('Line 10');
    expect(result).not.toContain('Line 4');
  });

  /**
   * Ensures the function handles empty input gracefully.
   */
  it('should handle empty log text', () => {
    const logText = '';
    const errorSignature = 'error';

    const result = extractErrorContext(logText, errorSignature);

    expect(result).toBe('');
  });
});

/**
 * Test suite for the `sanitizeForLlm` utility function.
 * This function prepares log text for an LLM by removing noise and redacting secrets.
 */
describe('sanitizeForLlm', () => {
  /**
   * Verifies that ANSI color codes and other escape sequences are stripped from the text.
   */
  it('should remove ANSI escape codes', () => {
    const logWithAnsi = 'Normal text\x1b[31mRed text\x1b[0mMore text';

    const result = sanitizeForLlm(logWithAnsi);

    expect(result).toBe('Normal textRed textMore text');
  });

  /**
   * Verifies that common secret formats (API keys, tokens, passwords) are redacted.
   */
  it('should redact secret patterns', () => {
    const logWithSecrets = `API_KEY=sk_test_1234567890abcdef1234567890
TOKEN: ghp_abcdef1234567890abcdef1234567890
PASSWORD: mySecretPass1234567890abcdef`;

    const result = sanitizeForLlm(logWithSecrets);

    expect(result).toContain('API_KEY=[REDACTED]');
    expect(result).toContain('TOKEN: [REDACTED]');
    expect(result).toContain('PASSWORD: [REDACTED]');
  });

  /**
   * Ensures that multiple secrets on the same line are all redacted correctly.
   */
  it('should handle multiple secret patterns', () => {
    const logWithMultipleSecrets = 'key=sk_live_1234567890abcdef token=pk_test_1234567890abcdef';

    const result = sanitizeForLlm(logWithMultipleSecrets);

    expect(result).toContain('key=[REDACTED]');
    expect(result).toContain('token=[REDACTED]');
  });

  /**
   * Verifies that text containing no secrets or ANSI codes remains unchanged.
   */
  it('should not modify text without secrets', () => {
    const cleanLog = 'This is a normal log message without secrets.';

    const result = sanitizeForLlm(cleanLog);

    expect(result).toBe(cleanLog);
  });
});