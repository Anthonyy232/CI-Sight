import {spawn} from 'child_process';
import path from 'path';
import {config} from '../config';
import {logger} from '../utils/logger';

const PROJECT_ROOT = path.join(__dirname, '../../..');
const SCRIPTS_PATH = path.join(PROJECT_ROOT, 'ml', 'scripts');
const SCRIPT_TIMEOUT = 10000; // 10 seconds

interface ClassifierOutput {
  category: string;
  confidence?: number;
}

interface SimilarityOutput {
  id: number;
  errorText: string;
  solution: string;
  category: string;
  similarity: number;
}

/**
 * A generic runner for Python scripts that communicate via stdin/stdout JSON.
 * This avoids the overhead of an HTTP server for simple ML model inference.
 * @param scriptName The filename of the script in the SCRIPTS_PATH directory.
 * @param inputData The JavaScript object to be sent to the script as JSON.
 * @returns A promise that resolves with the parsed JSON output from the script.
 */
function runPythonScript<T>(scriptName: string, inputData: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(SCRIPTS_PATH, scriptName);

    const pyProcess = spawn(config.PYTHON_EXECUTABLE, [scriptPath]);

    const timeoutId = setTimeout(() => {
      pyProcess.kill('SIGKILL'); // Force kill the process on timeout
      reject(new Error(`Python script ${scriptName} timed out after ${SCRIPT_TIMEOUT}ms`));
    }, SCRIPT_TIMEOUT);

    let outputJson = '';
    let errorOutput = '';

    pyProcess.stdout.on('data', (data) => {
      outputJson += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pyProcess.on('close', (code) => {
      clearTimeout(timeoutId); // Clear the timeout since the process finished

      if (code !== 0) {
        logger.error(`Python script ${scriptName} exited with code ${code}`, {
          scriptPath,
          stderr: errorOutput,
        });
        return reject(new Error(errorOutput || `Python script exited with code ${code}`));
      }
      try {
        const result = JSON.parse(outputJson);
        resolve(result as T);
      } catch (e) {
        logger.error(`Failed to parse JSON from Python script: ${scriptName}`, {
          rawOutput: outputJson,
        });
        reject(new Error('Failed to parse Python script output as JSON.'));
      }
    });

    pyProcess.stdin.write(JSON.stringify(inputData));
    pyProcess.stdin.end();
  });
}

/**
 * Classifies log text into a predefined category using a zero-shot model.
 */
export async function classifyError(logText: string): Promise<ClassifierOutput> {
  const candidateLabels = ['Dependency Error', 'Test Failure', 'Syntax Error', 'Runtime Error', 'Build Environment Error'];
  const input = {
    log_text: logText,
    labels: candidateLabels,
  };
  return runPythonScript<ClassifierOutput>('classify_error.py', input);
}

/**
 * Finds the most similar known error from the database using vector embeddings.
 */
export async function findSimilarity(errorText: string): Promise<SimilarityOutput | null> {
  const input = {
    error_text: errorText,
  };
  const result = await runPythonScript<SimilarityOutput | { error: string }>('find_similarity.py', input);
  // The Python script returns an 'error' object if no matches are found.
  if ('error' in result) {
    return null;
  }
  return result;
}