import axios from 'axios';
import {logger} from '../utils/logger';
import {config} from '../config';

const OLLAMA_API_URL = config.OLLAMA_API_URL;
const OLLAMA_MODEL = config.OLLAMA_MODEL;

/**
 * Generate a solution from a log snippet using the configured LLM.
 *
 * The prompt is intentionally concise and instructs the model to avoid
 * repeating log content. Returns `null` on any communication or parsing failures
 * so callers can fallback gracefully.
 *
 * @param sanitizedLogContext A focused, cleaned snippet of log text containing the error.
 * @returns A promise resolving to the generated solution string, or null on failure.
 */
export async function generateSolution(sanitizedLogContext: string): Promise<string | null> {
  const prompt = `
    Analyze the following log snippet from a CI/CD build.
    Provide a concise, actionable solution for the primary error.
    Do not repeat the log content. Focus only on the solution.

    Log Snippet:
    ---
    ${sanitizedLogContext}
    ---

    Suggested Solution:
  `;

  try {
  // Log the model query for observability; Ollama may be local in dev.
  logger.info(`Querying Ollama model '${OLLAMA_MODEL}' for a solution.`);
    const response = await axios.post(
      OLLAMA_API_URL,
      {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
      },
      {
        timeout: 60000,
      }
    );

    const solution = response.data?.response?.trim();

    if (!solution) {
      logger.warn('Ollama response was empty or malformed.', { responseData: response.data });
      return null;
    }

    logger.info(`Received solution from Ollama.`);
    return solution;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Error communicating with Ollama at ${OLLAMA_API_URL}. Is it running?`, {
        message: error.message,
        code: error.code,
      });
    } else {
      logger.error('An unexpected error occurred while querying the LLM.', { error });
    }
    return null;
  }
}