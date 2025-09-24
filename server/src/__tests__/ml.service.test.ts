// src/__tests__/ml.service.test.ts

import {spawn} from 'child_process';
import {classifyError, findSimilarity} from '../services/ml.service';

// Mock child_process
jest.mock('child_process');
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock config to provide a predictable executable path
jest.mock('../config', () => ({
  config: {
    PYTHON_EXECUTABLE: 'python3',
  },
}));

// Mock logger to suppress error output in tests
jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('ML Service', () => {
  let mockChildProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use fake timers to control setTimeout for timeout tests
    jest.useFakeTimers();

    mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      stdin: { write: jest.fn(), end: jest.fn() },
      kill: jest.fn(),
    };

    mockedSpawn.mockReturnValue(mockChildProcess as any);
  });

  afterEach(() => {
    // Restore real timers after each test
    jest.useRealTimers();
  });

  describe('classifyError', () => {
    it('should successfully classify error text', async () => {
      // Arrange
      const logText = 'npm ERR! code ENOTFOUND';
      const expectedResult = { category: 'Dependency Error', confidence: 0.95 };
      const promise = classifyError(logText);

      // Act
      // Simulate successful script execution: stdout writes data, then 'close' event fires with code 0
      mockChildProcess.stdout.on.mock.calls[0][1](JSON.stringify(expectedResult));
      mockChildProcess.on.mock.calls[0][1](0); // 'close' event with exit code 0
      const result = await promise;

      // Assert
      expect(mockedSpawn).toHaveBeenCalledWith('python3', [expect.stringContaining('classify_error.py')]);
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(expect.any(String));
      expect(result).toEqual(expectedResult);
    });

    it('should reject if the python script exits with a non-zero code', async () => {
      // Arrange
      const logText = 'some error';
      const promise = classifyError(logText);

      // Act
      // Simulate script failure: stderr writes an error, then 'close' event fires with code 1
      mockChildProcess.stderr.on.mock.calls[0][1]('Traceback: ...');
      mockChildProcess.on.mock.calls[0][1](1); // 'close' event with exit code 1

      // Assert
      await expect(promise).rejects.toThrow('Traceback: ...');
    });

    it('should reject if the python script times out', async () => {
      // Arrange
      const logText = 'some error';
      const promise = classifyError(logText);

      // Act
      // Fast-forward time past the 10-second timeout
      jest.advanceTimersByTime(11000);

      // Assert
      await expect(promise).rejects.toThrow(/timed out after 10000ms/);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('findSimilarity', () => {
    it('should successfully find a similar error', async () => {
      // Arrange
      const errorText = 'npm install failed';
      const expectedResult = { id: 1, similarity: 0.87 };
      const promise = findSimilarity(errorText);

      // Act
      mockChildProcess.stdout.on.mock.calls[0][1](JSON.stringify(expectedResult));
      mockChildProcess.on.mock.calls[0][1](0);
      const result = await promise;

      // Assert
      expect(mockedSpawn).toHaveBeenCalledWith('python3', [expect.stringContaining('find_similarity.py')]);
      expect(result).toEqual(expectedResult);
    });

    it('should return null if the script finds no matches and returns an error object', async () => {
      // Arrange
      const errorText = 'a very unique error';
      const scriptOutput = { error: 'No similar entries found in the database.' };
      const promise = findSimilarity(errorText);

      // Act
      mockChildProcess.stdout.on.mock.calls[0][1](JSON.stringify(scriptOutput));
      mockChildProcess.on.mock.calls[0][1](0);
      const result = await promise;

      // Assert
      expect(result).toBeNull();
    });
  });
});