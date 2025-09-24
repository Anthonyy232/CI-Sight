import {spawn} from 'child_process';
import {classifyError, findSimilarity} from '../services/ml.service';

jest.mock('child_process');
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

jest.mock('../config', () => ({
  config: {
    PYTHON_EXECUTABLE: 'python3',
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

/**
 * Test suite for the ML Service.
 * This suite verifies the interaction with external Python scripts for machine learning
 * tasks, ensuring correct data piping, result parsing, and error handling, including timeouts.
 */
describe('ML Service', () => {
  let mockChildProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
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
    jest.useRealTimers();
  });

  /**
   * Tests for the `classifyError` function.
   */
  describe('classifyError', () => {
    /**
     * Verifies the successful execution of the classification script, including
     * writing input to stdin and parsing the JSON result from stdout.
     */
    it('should successfully classify error text', async () => {
      const logText = 'npm ERR! code ENOTFOUND';
      const expectedResult = { category: 'Dependency Error', confidence: 0.95 };
      const promise = classifyError(logText);

      mockChildProcess.stdout.on.mock.calls[0][1](JSON.stringify(expectedResult));
      mockChildProcess.on.mock.calls[0][1](0); // 'close' event with exit code 0
      const result = await promise;

      expect(mockedSpawn).toHaveBeenCalledWith('python3', [expect.stringContaining('classify_error.py')]);
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(expect.any(String));
      expect(result).toEqual(expectedResult);
    });

    /**
     * Ensures that the promise is rejected if the Python script exits with a
     * non-zero status code, indicating an error.
     */
    it('should reject if the python script exits with a non-zero code', async () => {
      const logText = 'some error';
      const promise = classifyError(logText);

      mockChildProcess.stderr.on.mock.calls[0][1]('Traceback: ...');
      mockChildProcess.on.mock.calls[0][1](1); // 'close' event with exit code 1

      await expect(promise).rejects.toThrow('Traceback: ...');
    });

    /**
     * Verifies that the process is killed and the promise is rejected if the
     * script does not complete within the specified timeout period.
     */
    it('should reject if the python script times out', async () => {
      const logText = 'some error';
      const promise = classifyError(logText);

      jest.advanceTimersByTime(11000);

      await expect(promise).rejects.toThrow(/timed out after 10000ms/);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  /**
   * Tests for the `findSimilarity` function.
   */
  describe('findSimilarity', () => {
    /**
     * Verifies the successful execution of the similarity search script.
     */
    it('should successfully find a similar error', async () => {
      const errorText = 'npm install failed';
      const expectedResult = { id: 1, similarity: 0.87 };
      const promise = findSimilarity(errorText);

      mockChildProcess.stdout.on.mock.calls[0][1](JSON.stringify(expectedResult));
      mockChildProcess.on.mock.calls[0][1](0);
      const result = await promise;

      expect(mockedSpawn).toHaveBeenCalledWith('python3', [expect.stringContaining('find_similarity.py')]);
      expect(result).toEqual(expectedResult);
    });

    /**
     * Verifies that the function returns `null` when the script indicates that no
     * similar entries were found.
     */
    it('should return null if the script finds no matches and returns an error object', async () => {
      const errorText = 'a very unique error';
      const scriptOutput = { error: 'No similar entries found in the database.' };
      const promise = findSimilarity(errorText);

      mockChildProcess.stdout.on.mock.calls[0][1](JSON.stringify(scriptOutput));
      mockChildProcess.on.mock.calls[0][1](0);
      const result = await promise;

      expect(result).toBeNull();
    });
  });
});