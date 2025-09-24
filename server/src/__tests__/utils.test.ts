import {asyncHandler} from '../utils/asyncHandler';
import {extractErrorContext, sanitizeForLlm} from '../utils/log-parser';

describe('asyncHandler', () => {
  it('should call the async function and resolve successfully', async () => {
    // Arrange
    const mockReq = { body: 'test' };
    const mockRes = { json: jest.fn() };
    const mockNext = jest.fn();
    const mockHandler = jest.fn().mockResolvedValue('success');

    // Act
    const handler = asyncHandler(mockHandler);
    await handler(mockReq as any, mockRes as any, mockNext);

    // Assert
    expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next with error when async function throws', async () => {
    // Arrange
    const mockReq = {};
    const mockRes = {};
    const mockNext = jest.fn();
    const error = new Error('Test error');
    const mockHandler = jest.fn().mockRejectedValue(error);

    // Act
    const handler = asyncHandler(mockHandler);
    await handler(mockReq as any, mockRes as any, mockNext);

    // Assert
    expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(error);
  });
});

describe('extractErrorContext', () => {
  it('should extract context around error signature', () => {
    // Arrange
    const logText = `Line 1: Info message
Line 2: Debug info
Line 3: Error: Something went wrong
Line 4: More details
Line 5: Stack trace
Line 6: End of log`;
    const errorSignature = 'Error: Something went wrong';

    // Act
    const result = extractErrorContext(logText, errorSignature, 2);

    // Assert
    expect(result).toContain('Line 1: Info message');
    expect(result).toContain('Line 2: Debug info');
    expect(result).toContain('Line 3: Error: Something went wrong');
    expect(result).toContain('Line 4: More details');
    expect(result).toContain('Line 5: Stack trace');
    expect(result).not.toContain('Line 6: End of log');
  });

  it('should return last lines when error signature not found', () => {
    // Arrange
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

    // Act
    const result = extractErrorContext(logText, errorSignature, 3);

    // Assert
    expect(result.split('\n')).toHaveLength(6);
    expect(result).toContain('Line 5');
    expect(result).toContain('Line 10');
    expect(result).not.toContain('Line 4');
  });

  it('should handle empty log text', () => {
    // Arrange
    const logText = '';
    const errorSignature = 'error';

    // Act
    const result = extractErrorContext(logText, errorSignature);

    // Assert
    expect(result).toBe('');
  });
});

describe('sanitizeForLlm', () => {
  it('should remove ANSI escape codes', () => {
    // Arrange
    const logWithAnsi = 'Normal text\x1b[31mRed text\x1b[0mMore text';

    // Act
    const result = sanitizeForLlm(logWithAnsi);

    // Assert
    expect(result).toBe('Normal textRed textMore text');
  });

  it('should redact secret patterns', () => {
    // Arrange
    const logWithSecrets = `API_KEY=sk_test_1234567890abcdef1234567890
TOKEN: ghp_abcdef1234567890abcdef1234567890
PASSWORD: mySecretPass1234567890abcdef`;

    // Act
    const result = sanitizeForLlm(logWithSecrets);

    // Assert
    expect(result).toContain('API_KEY=[REDACTED]');
    expect(result).toContain('TOKEN: [REDACTED]');
    expect(result).toContain('PASSWORD: [REDACTED]');
  });

  it('should handle multiple secret patterns', () => {
    // Arrange
    const logWithMultipleSecrets = 'key=sk_live_1234567890abcdef token=pk_test_1234567890abcdef';

    // Act
    const result = sanitizeForLlm(logWithMultipleSecrets);

    // Assert
    expect(result).toContain('key=[REDACTED]');
    expect(result).toContain('token=[REDACTED]');
  });

  it('should not modify text without secrets', () => {
    // Arrange
    const cleanLog = 'This is a normal log message without secrets.';

    // Act
    const result = sanitizeForLlm(cleanLog);

    // Assert
    expect(result).toBe(cleanLog);
  });
});