import {errorHandler} from '../middleware/error.middleware';
import {logger} from '../utils/logger';

const mockedLogger = logger as jest.Mocked<typeof logger>;

/**
 * Test suite for the global error handling middleware.
 * This suite verifies that errors are logged and formatted correctly based
 * on the application environment (production vs. development).
 */
describe('errorHandler', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      path: '/api/test',
      method: 'GET',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      statusCode: 200,
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  /**
   * Verifies that in a production environment, errors are logged with details,
   * but the client receives a generic 500 Internal Server Error message.
   */
  it('should log error and send 500 response in production', () => {
    const error = new Error('Test error');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      'An unexpected error occurred:',
      expect.objectContaining({
        error: 'Test error',
        stack: error.stack,
        path: '/api/test',
        method: 'GET',
      })
    );
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });

    process.env.NODE_ENV = originalEnv;
  });

  /**
   * Verifies that in a development environment, the specific error message is
   * included in the JSON response to aid in debugging.
   */
  it('should include error message in development', () => {
    const error = new Error('Development error');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Development error',
    });

    process.env.NODE_ENV = originalEnv;
  });

  /**
   * Ensures that if a status code has already been set on the response (e.g., by a
   * controller), the error handler respects it instead of defaulting to 500.
   */
  it('should use existing status code if set', () => {
    const error = new Error('Bad request');
    mockRes.statusCode = 400;

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  /**
   * Verifies that the error handler can gracefully handle error objects
   * that may not have a stack trace.
   */
  it('should handle errors without stack trace', () => {
    const error = new Error('No stack');
    error.stack = undefined;

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      'An unexpected error occurred:',
      expect.objectContaining({
        error: 'No stack',
        stack: undefined,
      })
    );
  });
});