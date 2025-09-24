// src/__tests__/queue.service.test.ts

import {TEST_TOKEN_ENCRYPTION_KEY} from './testUtils';

describe('QueueService', () => {
  // Clean up mocks and module cache after each test to prevent pollution
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should add job to queue when Redis is enabled', async () => {
    // Arrange
    // Mock config specifically for this test
    jest.mock('../config', () => ({
      config: {
        USE_REDIS: true,
        REDIS_URL: 'redis://localhost:6379',
        // Ensure CryptoService can initialize without throwing during module load
        TOKEN_ENCRYPTION_KEY: TEST_TOKEN_ENCRYPTION_KEY,
      },
    }));
    // Mock bullmq to avoid actual Redis connection
    jest.mock('bullmq');
    const BullMQ = require('bullmq');
    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      close: jest.fn(),
    };
    BullMQ.Queue.mockImplementation(() => mockQueue);
    // Mock the worker to prevent it from running
    BullMQ.Worker.mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn(),
    }));

    // Act
    // Require the service *after* mocks are in place
    const { QueueService } = require('../services/queue.service');
    const queueService = new QueueService();
    const result = await queueService.addLogJob({ data: 'test' });

    // Assert
    expect(queueService.isAvailable).toBe(true);
    expect(mockQueue.add).toHaveBeenCalledWith('process-log-job', { data: 'test' });
    expect(result).toEqual({ queued: true, jobId: 'job-1' });
  });

  it('should process jobs inline when Redis is disabled', async () => {
    // Arrange
    // Mock config specifically for this test
    jest.mock('../config', () => ({
      config: {
        USE_REDIS: false,
        // Provide a fallback encryption key to avoid CryptoService reading undefined
        TOKEN_ENCRYPTION_KEY: TEST_TOKEN_ENCRYPTION_KEY,
      },
    }));
    // Mock the job processor that would be called inline
    jest.mock('../jobs/logProcessor.job', () => ({
      processLogJob: jest.fn().mockResolvedValue({ success: true }),
    }));

    // Act
    // Require the service and its dependency *after* mocks are in place
    const { QueueService } = require('../services/queue.service');
    const { processLogJob } = require('../jobs/logProcessor.job');
    const queueService = new QueueService();
    const result = await queueService.addLogJob({ data: 'inline-test' });

    // Assert
    expect(queueService.isAvailable).toBe(false);
    expect(processLogJob).toHaveBeenCalledWith(expect.objectContaining({ data: { data: 'inline-test' } }));
    expect(result).toEqual({ queued: false, result: { success: true } });
  });
});