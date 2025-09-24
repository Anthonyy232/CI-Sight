import axios from 'axios';
import {generateSolution} from '../services/llm.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../config', () => ({
  config: {
    OLLAMA_API_URL: 'http://localhost:11434/api/generate',
    OLLAMA_MODEL: 'codellama:7b',
  },
}));

/**
 * Test suite for the LLM (Large Language Model) Service.
 * This suite verifies the interaction with the Ollama API, including successful
 * solution generation and robust handling of various API responses and network errors.
 */
describe('LLM Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Tests for the `generateSolution` function.
   */
  describe('generateSolution', () => {
    const mockLogContext = 'Error: npm install failed\nStack trace: ...';

    /**
     * Verifies a successful API call to the Ollama service and the extraction
     * of the generated solution from the response.
     */
    it('should successfully generate a solution from Ollama API', async () => {
      const mockResponse = {
        data: {
          response: 'Try running npm install with --force flag.',
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await generateSolution(mockLogContext);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        {
          model: 'codellama:7b',
          prompt: expect.stringContaining('Analyze the following log snippet'),
          stream: false,
        },
        {
          timeout: 60000,
        }
      );
      expect(result).toBe('Try running npm install with --force flag.');
    });

    /**
     * Ensures that the log context provided to the function is correctly embedded
     * within the prompt sent to the LLM.
     */
    it('should include the log context in the prompt', async () => {
      const mockResponse = { data: { response: 'Solution here' } };
      mockedAxios.post.mockResolvedValue(mockResponse);

      await generateSolution(mockLogContext);

      const callArgs = mockedAxios.post.mock.calls[0][1] as any;
      expect(callArgs.prompt).toContain(mockLogContext);
    });

    /**
     * Verifies that the function returns `null` if the API returns an empty response string.
     */
    it('should return null when API response is empty', async () => {
      const mockResponse = { data: { response: '' } };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await generateSolution(mockLogContext);

      expect(result).toBeNull();
    });

    /**
     * Verifies that the function returns `null` if the API response is missing the `response` field.
     */
    it('should return null when API response has no response field', async () => {
      const mockResponse = { data: {} };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await generateSolution(mockLogContext);

      expect(result).toBeNull();
    });

    /**
     * Verifies that the function returns `null` for a malformed API response (e.g., null data).
     */
    it('should return null when API response is malformed', async () => {
      const mockResponse = { data: null };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await generateSolution(mockLogContext);

      expect(result).toBeNull();
    });

    /**
     * Ensures that network errors during the API call are handled gracefully, returning `null`.
     */
    it('should handle axios network errors', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.post.mockRejectedValue(networkError);

      const result = await generateSolution(mockLogContext);

      expect(result).toBeNull();
    });

    /**
     * Ensures that request timeouts are handled gracefully, returning `null`.
     */
    it('should handle axios timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      const axiosError = { ...timeoutError, isAxiosError: true, code: 'ECONNABORTED' };
      mockedAxios.post.mockRejectedValue(axiosError);

      const result = await generateSolution(mockLogContext);

      expect(result).toBeNull();
    });

    /**
     * Ensures that non-2xx HTTP responses are handled gracefully, returning `null`.
     */
    it('should handle HTTP error responses', async () => {
      const httpError = {
        isAxiosError: true,
        response: { status: 500, data: { error: 'Internal Server Error' } },
      };
      mockedAxios.post.mockRejectedValue(httpError);

      const result = await generateSolution(mockLogContext);

      expect(result).toBeNull();
    });

    /**
     * Ensures that connection refused errors are handled gracefully, returning `null`.
     */
    it('should handle connection refused errors', async () => {
      const connectionError = { isAxiosError: true, code: 'ECONNREFUSED', message: 'Connection refused' };
      mockedAxios.post.mockRejectedValue(connectionError);

      const result = await generateSolution(mockLogContext);

      expect(result).toBeNull();
    });

    /**
     * Verifies that leading/trailing whitespace is trimmed from the LLM's response.
     */
    it('should trim whitespace from the response', async () => {
      const mockResponse = { data: { response: '  Solution with extra whitespace  \n\n  ' } };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await generateSolution(mockLogContext);

      expect(result).toBe('Solution with extra whitespace');
    });

    /**
     * Verifies that the service can handle and correctly process very long log inputs.
     */
    it('should handle very long log contexts', async () => {
      const longLogContext = 'Error: '.repeat(1000) + 'Long log content';
      const mockResponse = { data: { response: 'Solution for long log' } };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await generateSolution(longLogContext);

      expect(result).toBe('Solution for long log');
      const callArgs = mockedAxios.post.mock.calls[0][1] as any;
      expect(callArgs.prompt).toContain(longLogContext);
    });
  });
});