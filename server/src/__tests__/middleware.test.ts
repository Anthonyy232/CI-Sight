import {errorHandler} from '../middleware/error.middleware';
import {logger} from '../utils/logger';

const mockedLogger = logger as jest.Mocked<typeof logger>;

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

  it('should log error and send 500 response in production', () => {
    // Arrange
    const error = new Error('Test error');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Act
    errorHandler(error, mockReq, mockRes, mockNext);

    // Assert
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

    // Cleanup
    process.env.NODE_ENV = originalEnv;
  });

  it('should include error message in development', () => {
    // Arrange
    const error = new Error('Development error');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // Act
    errorHandler(error, mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Development error',
    });

    // Cleanup
    process.env.NODE_ENV = originalEnv;
  });

  it('should use existing status code if set', () => {
    // Arrange
    const error = new Error('Bad request');
    mockRes.statusCode = 400;

    // Act
    errorHandler(error, mockReq, mockRes, mockNext);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('should handle errors without stack trace', () => {
    // Arrange
    const error = new Error('No stack');
    error.stack = undefined;

    // Act
    errorHandler(error, mockReq, mockRes, mockNext);

    // Assert
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'An unexpected error occurred:',
      expect.objectContaining({
        error: 'No stack',
        stack: undefined,
      })
    );
  });
});