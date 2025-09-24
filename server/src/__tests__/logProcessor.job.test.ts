import { prisma } from '../db';
import { classifyError, findSimilarity } from '../services/ml.service';
import { generateSolution } from '../services/llm.service';
import { CryptoService } from '../services/crypto.service';
import { BuildStatus } from '@prisma/client';
import axios from 'axios';
import AdmZip from 'adm-zip';

jest.mock('../db', () => ({
  prisma: {
    repoLink: { findFirst: jest.fn() },
    build: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    logEntry: { deleteMany: jest.fn(), createMany: jest.fn(), count: jest.fn() },
    project: { upsert: jest.fn() },
  },
}));
jest.mock('../services/ml.service');
jest.mock('../services/llm.service');
jest.mock('../services/crypto.service');
jest.mock('../utils/log-parser', () => ({
  extractErrorContext: jest.fn((logText, errorSignature) => `context: ${logText}`),
  sanitizeForLlm: jest.fn(text => `sanitized: ${text}`),
}));
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('axios');
jest.mock('adm-zip');

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedClassifyError = classifyError as jest.MockedFunction<typeof classifyError>;
const mockedFindSimilarity = findSimilarity as jest.MockedFunction<typeof findSimilarity>;
const mockedGenerateSolution = generateSolution as jest.MockedFunction<typeof generateSolution>;
const mockedCryptoService = CryptoService as jest.MockedClass<typeof CryptoService>;
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedAdmZip = AdmZip as jest.MockedClass<typeof AdmZip>;

/**
 * Test suite for the log processing background job.
 * This suite verifies the end-to-end logic of handling a GitHub webhook payload,
 * including fetching logs, analyzing failures, and updating build status in the database.
 */
describe('Log Processor Job', () => {
  let processLogJob: (job: any) => Promise<any>;

  const mockPayload = {
    repository: { full_name: 'owner/repo' },
    workflow_run: {
      id: 12345,
      conclusion: 'failure',
      status: 'completed',
      run_started_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:05:00Z',
      head_sha: 'abc123def456',
      logs_url: 'https://api.github.com/logs',
    },
  };
  const mockJob = { id: 'test-job-1', data: { payload: mockPayload } };
  const mockProject = { id: 1, name: 'repo', githubRepoUrl: 'owner/repo' };
  const mockBuild = { id: 1, status: BuildStatus.FAILURE, githubRunId: '12345' };
  const mockRepoLink = { user: { id: 1, accessToken: 'encrypted-token' } };
  const mockLogText = 'Log line 1\nnpm err! This is the error signature\nLog line 3';

  beforeEach(() => {
    jest.clearAllMocks();

    const cryptoServiceInstance = { decrypt: jest.fn().mockReturnValue('decrypted-token') } as any;
    mockedCryptoService.mockImplementation(() => cryptoServiceInstance);

    (mockedPrisma.project.upsert as jest.Mock).mockResolvedValue(mockProject);
    (mockedPrisma.build.upsert as jest.Mock).mockResolvedValue(mockBuild as any);
    (mockedPrisma.build.findUnique as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.logEntry.count as jest.Mock).mockResolvedValue(0);
    (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(mockRepoLink as any);

    const mockZipEntry = {
      isDirectory: false,
      entryName: 'job/1_step.txt',
      getData: jest.fn().mockReturnValue(Buffer.from(mockLogText)),
    };
    const mockZipInstance = { getEntries: jest.fn().mockReturnValue([mockZipEntry]) };
    mockedAdmZip.mockImplementation(() => mockZipInstance as any);

    mockedAxios.get.mockResolvedValue({ data: Buffer.from('zip-data') });
    mockedClassifyError.mockResolvedValue({ category: 'Build Failure' });
    
    processLogJob = require('../jobs/logProcessor.job').processLogJob;
  });

  /**
   * Verifies that the job fails early if the webhook payload is missing essential data.
   */
  it('should throw an error if critical payload data is missing', async () => {
    const badJob = { id: 'bad-job', data: { payload: { repository: {} } } };
    
    await expect(processLogJob(badJob)).rejects.toThrow('Job bad-job missing critical data: runId or repoFullName');
  });

  /**
   * Tests the logic for analyzing build failures.
   */
  describe('Build Failure Analysis', () => {
    /**
     * Verifies that if a high-confidence match is found in the knowledge base,
     * its solution is used directly, and the LLM is not called.
     */
    it('should use a high-confidence similarity match and skip the LLM', async () => {
      mockedFindSimilarity.mockResolvedValue({
        id: 123,
        errorText: 'mock error',
        category: 'Build Failure',
        similarity: 0.95,
        solution: 'Known solution from KB',
      });

      await processLogJob(mockJob);

      expect(mockedFindSimilarity).toHaveBeenCalledWith(expect.stringContaining('This is the error signature'));
      expect(mockedGenerateSolution).not.toHaveBeenCalled();
      expect(mockedPrisma.build.update).toHaveBeenCalledWith({
        where: { id: mockBuild.id },
        data: {
          errorCategory: 'Build Failure',
          failureReason: 'Known solution from KB',
        },
      });
    });

    /**
     * Verifies that when no high-confidence match is found, the system falls back
     * to the LLM to generate a new solution.
     */
    it('should fall back to the LLM when no high-confidence match is found', async () => {
      mockedFindSimilarity.mockResolvedValue({
        id: 456,
        errorText: 'mock error',
        category: 'Build Failure',
        similarity: 0.5,
        solution: 'Low confidence solution',
      });
      mockedGenerateSolution.mockResolvedValue('A new solution from the LLM');
      const expectedInputToLlm = `sanitized: context: ${mockLogText}`;

      await processLogJob(mockJob);

      expect(mockedFindSimilarity).toHaveBeenCalled();
      expect(mockedGenerateSolution).toHaveBeenCalledWith(expectedInputToLlm);
      expect(mockedPrisma.build.update).toHaveBeenCalledWith({
        where: { id: mockBuild.id },
        data: {
          errorCategory: 'Build Failure',
          failureReason: 'A new solution from the LLM',
        },
      });
    });
    
    /**
     * Verifies that if the LLM fails to generate a solution, the system uses the
     * best available (even if low-confidence) match from the similarity search as a fallback.
     */
    it('should handle LLM failure by using the best available similarity match', async () => {
        mockedFindSimilarity.mockResolvedValue({
            id: 789,
            errorText: 'mock error',
            category: 'Build Failure',
            similarity: 0.6,
            solution: 'Low confidence solution',
        });
        mockedGenerateSolution.mockResolvedValue(null);
  
        await processLogJob(mockJob);
  
        expect(mockedGenerateSolution).toHaveBeenCalled();
        expect(mockedPrisma.build.update).toHaveBeenCalledWith({
          where: { id: mockBuild.id },
          data: {
            errorCategory: 'Build Failure',
            failureReason: 'Could not generate a new solution. The most similar known issue suggests: Low confidence solution',
          },
        });
      });
  });

  /**
   * Tests the logic related to fetching and persisting build logs.
   */
  describe('Log Fetching Logic', () => {
    /**
     * Ensures that logs are not re-downloaded if they already exist in the database for a given build,
     * preventing redundant processing.
     */
    it('should not fetch logs if they already exist for the build', async () => {
        (mockedPrisma.logEntry.count as jest.Mock).mockResolvedValue(100);
  
        await processLogJob(mockJob);
  
        expect(mockedAxios.get).not.toHaveBeenCalled();
        expect(mockedFindSimilarity).not.toHaveBeenCalled();
    });
    
    /**
     * Verifies that if the log download from GitHub fails, the analysis process is aborted.
     */
    it('should not attempt analysis if log download fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('GitHub API timeout'));

      await processLogJob(mockJob);

      const { logger } = require('../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to download or extract logs'), expect.any(Object));
      expect(mockedPrisma.logEntry.createMany).not.toHaveBeenCalled();
      expect(mockedFindSimilarity).not.toHaveBeenCalled();
    });

    /**
     * Verifies that log fetching is skipped if no authenticated user link is found
     * for the repository, as a token is required for the API call.
     */
    it('should not attempt analysis if no repo link with a token is found', async () => {
        (mockedPrisma.repoLink.findFirst as jest.Mock).mockResolvedValue(null);
  
        await processLogJob(mockJob);
  
        const { logger } = require('../utils/logger');
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No active user link found'));
        expect(mockedAxios.get).not.toHaveBeenCalled();
        expect(mockedFindSimilarity).not.toHaveBeenCalled();
    });
  });
  
  /**
   * Tests the handling of different stages and outcomes of a build lifecycle.
   */
  describe('Build Lifecycle Handling', () => {
    /**
     * Verifies that a successful build is processed (logs are saved) but does not
     * trigger the failure analysis workflow.
     */
    it('should process a successful build without triggering failure analysis', async () => {
      const successPayload = {
        ...mockPayload,
        workflow_run: { ...mockPayload.workflow_run, conclusion: 'success' },
      };
      const successJob = { ...mockJob, data: { payload: successPayload } };
      (mockedPrisma.build.upsert as jest.Mock).mockResolvedValue({ ...mockBuild, status: BuildStatus.SUCCESS });

      await processLogJob(successJob);

      expect(mockedAxios.get).toHaveBeenCalled();
      expect(mockedPrisma.logEntry.createMany).toHaveBeenCalled();
      expect(mockedFindSimilarity).not.toHaveBeenCalled();
      expect(mockedGenerateSolution).not.toHaveBeenCalled();
    });

    /**
     * Verifies that when a build is re-run (moves from a completed state to 'in_progress'),
     * the job correctly deletes the old logs and resets the build's status and data.
     */
    it('should handle a build rerun by deleting old logs and resetting status', async () => {
      const rerunPayload = {
          ...mockPayload,
          workflow_run: { ...mockPayload.workflow_run, conclusion: null, status: 'in_progress' },
        };
      const rerunJob = { ...mockJob, data: { payload: rerunPayload } };
      const existingFailedBuild = { ...mockBuild, id: 99, status: BuildStatus.FAILURE };
      (mockedPrisma.build.findUnique as jest.Mock).mockResolvedValue(existingFailedBuild);

      await processLogJob(rerunJob);

      expect(mockedPrisma.logEntry.deleteMany).toHaveBeenCalledWith({ where: { buildId: existingFailedBuild.id } });
      expect(mockedPrisma.build.update).toHaveBeenCalledWith({
        where: { id: existingFailedBuild.id },
        data: {
          status: BuildStatus.RUNNING,
          completedAt: null,
          failureReason: null,
          errorCategory: null,
          startedAt: new Date(rerunPayload.workflow_run.run_started_at),
        },
      });
    });
  });
});