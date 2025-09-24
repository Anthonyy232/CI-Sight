import axios from 'axios';
import {generateSolution} from '../services/llm.service';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('../config', () => ({
  config: {
    OLLAMA_API_URL: 'http://localhost:11434/api/generate',
    OLLAMA_MODEL: 'codellama:7b',
  },
}));

describe('LLM Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSolution', () => {
    const mockLogContext = 'Error: npm install failed\nStack trace: ...';

    it('should successfully generate a solution from Ollama API', async () => {
      // Arrange
      const mockResponse = {
        data: {
          response: 'Try running npm install with --force flag.',
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
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

    it('should include the log context in the prompt', async () => {
      // Arrange
      const mockResponse = {
        data: {
          response: 'Solution here',
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      await generateSolution(mockLogContext);

      // Assert
      const callArgs = mockedAxios.post.mock.calls[0][1] as any;
      expect(callArgs.prompt).toContain(mockLogContext);
      expect(callArgs.prompt).toContain('Analyze the following log snippet');
      expect(callArgs.prompt).toContain('Suggested Solution:');
    });

    it('should return null when API response is empty', async () => {
      // Arrange
      const mockResponse = {
        data: {
          response: '',
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when API response has no response field', async () => {
      // Arrange
      const mockResponse = {
        data: {},
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when API response is malformed', async () => {
      // Arrange
      const mockResponse = {
        data: null,
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle axios network errors', async () => {
      // Arrange
      const networkError = new Error('Network Error');
      mockedAxios.post.mockRejectedValue(networkError);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle axios timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      const axiosError = {
        ...timeoutError,
        isAxiosError: true,
        code: 'ECONNABORTED',
      };
      mockedAxios.post.mockRejectedValue(axiosError);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle HTTP error responses', async () => {
      // Arrange
      const httpError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      };
      mockedAxios.post.mockRejectedValue(httpError);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle connection refused errors', async () => {
      // Arrange
      const connectionError = {
        isAxiosError: true,
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };
      mockedAxios.post.mockRejectedValue(connectionError);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
      expect(result).toBeNull();
    });

    it('should trim whitespace from the response', async () => {
      // Arrange
      const mockResponse = {
        data: {
          response: '  Solution with extra whitespace  \n\n  ',
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await generateSolution(mockLogContext);

      // Assert
      expect(result).toBe('Solution with extra whitespace');
    });

    it('should handle very long log contexts', async () => {
      // Arrange
      const longLogContext = 'Error: '.repeat(1000) + 'Long log content';
      const mockResponse = {
        data: {
          response: 'Solution for long log',
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await generateSolution(longLogContext);

      // Assert
      expect(result).toBe('Solution for long log');
      const callArgs = mockedAxios.post.mock.calls[0][1] as any;
      expect(callArgs.prompt).toContain(longLogContext);
    });
  });
});