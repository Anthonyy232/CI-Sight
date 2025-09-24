// src/__tests__/logProcessor.job.test.ts

let processLogJob: any;
import {prisma} from '../db';
import {classifyError, findSimilarity} from '../services/ml.service';
import {generateSolution} from '../services/llm.service';
import {CryptoService} from '../services/crypto.service';
import {BuildStatus} from '@prisma/client';
import axios from 'axios';
import AdmZip from 'adm-zip';

// Mock all module-level dependencies
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
jest.mock('../utils/log-parser', () => ({
  extractErrorContext: jest.fn(text => text),
  sanitizeForLlm: jest.fn(text => text),
}));
jest.mock('../services/crypto.service');
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('axios');
jest.mock('adm-zip');

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedClassifyError = classifyError as jest.MockedFunction<typeof classifyError>;
const mockedFindSimilarity = findSimilarity as jest.MockedFunction<typeof findSimilarity>;
const mockedGenerateSolution = generateSolution as jest.MockedFunction<typeof generateSolution>;
const mockedCryptoService = CryptoService as jest.MockedClass<typeof CryptoService>;
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedAdmZip = AdmZip as jest.MockedClass<typeof AdmZip>;

describe('Log Processor Job: processLogJob', () => {
  let cryptoService: jest.Mocked<CryptoService>;

  const mockJobData = {
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
  const mockJob = { id: 'test-job-1', data: { payload: mockJobData } };
  const mockProject = { id: 1, name: 'repo', githubRepoUrl: 'owner/repo' };
  const mockBuild = { id: 1, status: BuildStatus.FAILURE, githubRunId: '12345' };
  const mockRepoLink = { user: { id: 1, githubPat: 'encrypted-pat' } };

  beforeEach(() => {
    jest.clearAllMocks();

    cryptoService = { decrypt: jest.fn().mockReturnValue('decrypted-token'), encrypt: jest.fn() } as any;
    mockedCryptoService.mockImplementation(() => cryptoService);

  (mockedPrisma.project.upsert as unknown as jest.Mock).mockResolvedValue(mockProject);
  (mockedPrisma.build.upsert as unknown as jest.Mock).mockResolvedValue(mockBuild as any);
  (mockedPrisma.build.findUnique as unknown as jest.Mock).mockResolvedValue(null);
  (mockedPrisma.logEntry.count as unknown as jest.Mock).mockResolvedValue(0);
  (mockedPrisma.repoLink.findFirst as unknown as jest.Mock).mockResolvedValue(mockRepoLink as any);

    // FIX: The mock for AdmZip was incorrect. It must be a mock constructor
    // that returns an object with the methods used by the implementation.
    const mockZipEntry = {
      isDirectory: false,
      entryName: 'job/1_step.txt',
      getData: jest.fn().mockReturnValue(Buffer.from('Log line 1\nnpm ERR! Some error occurred\nLog line 3')),
    };
    const mockZipInstance = { getEntries: jest.fn().mockReturnValue([mockZipEntry]) };
    mockedAdmZip.mockImplementation(() => mockZipInstance as any);
    mockedAxios.get.mockResolvedValue({ data: Buffer.from('zip-data') });

    mockedClassifyError.mockResolvedValue({ category: 'Test Failure' });

    // Require the job module after all mocks are in place so its module-level
    // initialization (like `new CryptoService()`) uses our mocked implementations.
    const jobModule = require('../jobs/logProcessor.job');
    processLogJob = jobModule.processLogJob;
  });

  it('should process a failed build and use LLM when no high-confidence match is found', async () => {
    // Arrange
    mockedFindSimilarity.mockResolvedValue({ similarity: 0.5, solution: 'old solution' } as any);
    mockedGenerateSolution.mockResolvedValue('llm-generated-solution');

    // Act
    await processLogJob(mockJob as any);

    // Assert
    expect(mockedPrisma.logEntry.createMany).toHaveBeenCalled();
    expect(mockedGenerateSolution).toHaveBeenCalled();
    expect(mockedPrisma.build.update).toHaveBeenCalledWith({
      where: { id: mockBuild.id },
      data: {
        errorCategory: 'Test Failure',
        failureReason: 'llm-generated-solution',
      },
    });
  });

  it('should process a successful build without calling analysis services', async () => {
    // Arrange
    const successJob = {
      ...mockJob,
      data: {
        payload: {
          ...mockJobData,
          workflow_run: { ...mockJobData.workflow_run, conclusion: 'success' },
        },
      },
    };

    // Ensure the upsert returns a SUCCESS build so analysis is skipped
    (mockedPrisma.build.upsert as unknown as jest.Mock).mockResolvedValue({ ...mockBuild, status: BuildStatus.SUCCESS } as any);

    // Act
    await processLogJob(successJob as any);

    // Assert
    expect(mockedPrisma.build.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ status: BuildStatus.SUCCESS }),
      create: expect.objectContaining({ status: BuildStatus.SUCCESS }),
    }));
    expect(mockedFindSimilarity).not.toHaveBeenCalled();
    expect(mockedGenerateSolution).not.toHaveBeenCalled();
  });

  it('should handle a build rerun by deleting old logs and resetting build status', async () => {
    // Arrange
    const rerunJob = {
      ...mockJob,
      data: {
        payload: {
          ...mockJobData,
          workflow_run: { ...mockJobData.workflow_run, conclusion: null, status: 'in_progress' },
        },
      },
    };
    const existingFailedBuild = { ...mockBuild, status: BuildStatus.FAILURE };
  (mockedPrisma.build.findUnique as unknown as jest.Mock).mockResolvedValue(existingFailedBuild as any);

    // Act
    await processLogJob(rerunJob as any);

    // Assert
    expect(mockedPrisma.logEntry.deleteMany).toHaveBeenCalledWith({ where: { buildId: existingFailedBuild.id } });
    expect(mockedPrisma.build.update).toHaveBeenCalledWith({
      where: { id: existingFailedBuild.id },
      data: {
        status: BuildStatus.RUNNING,
        completedAt: null,
        failureReason: null,
        errorCategory: null,
        startedAt: new Date(mockJobData.workflow_run.run_started_at),
      },
    });
  });
});