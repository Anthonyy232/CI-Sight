import { TEST_TOKEN_ENCRYPTION_KEY } from './testUtils';

jest.mock('bullmq');
jest.mock('ioredis');
jest.mock('../jobs/logProcessor.job');
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/**
 * Test suite for the QueueService.
 * This suite verifies the service's behavior under different configurations:
 * when Redis is enabled, when Redis connection fails, and when Redis is disabled.
 * It uses `jest.isolateModules` to test different config-dependent initializations.
 */
describe('QueueService', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  /**
   * Tests the "happy path" where Redis is enabled and the connection is successful.
   */
  describe('when Redis is enabled and available', () => {
    let QueueService: any;
    let BullMQ: any;
    let IORedis: any;

    beforeEach(() => {
      jest.isolateModules(() => {
        jest.doMock('../config', () => ({
          config: {
            USE_REDIS: true,
            REDIS_URL: 'redis://mock-host:6379',
            TOKEN_ENCRYPTION_KEY: TEST_TOKEN_ENCRYPTION_KEY,
          },
        }));
        QueueService = require('../services/queue.service').QueueService;
        BullMQ = require('bullmq');
        IORedis = require('ioredis');
      });
    });

    /**
     * Verifies that the service initializes a Redis connection, creates a BullMQ
     * Queue and Worker, and successfully adds a job to the queue.
     */
    it('should initialize connection, create a queue and worker, and add a job', async () => {
      const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-123' }), close: jest.fn() };
      const mockWorker = { on: jest.fn(), close: jest.fn() };
      const mockRedisClient = { disconnect: jest.fn() };
      BullMQ.Queue.mockImplementation(() => mockQueue);
      BullMQ.Worker.mockImplementation(() => mockWorker);
      IORedis.mockImplementation(() => mockRedisClient);

      const queueService = new QueueService();
      const payload = { data: 'test-payload' };

      await queueService.init(); 
      const result = await queueService.addLogJob(payload);
      
      expect(queueService.isAvailable).toBe(true);
      expect(BullMQ.Queue).toHaveBeenCalledWith('log-processing', expect.any(Object));
      expect(BullMQ.Worker).toHaveBeenCalledWith('log-processing', expect.any(Function), expect.any(Object));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.add).toHaveBeenCalledWith('process-log-job', payload);
      expect(result).toEqual({ queued: true, jobId: 'job-123' });
    });
  });

  /**
   * Tests the fallback behavior when Redis is enabled but the connection fails.
   */
  describe('when Redis is enabled but connection fails', () => {
    /**
     * Verifies that the service logs an error, marks the queue as unavailable,
     * and processes jobs synchronously (inline) as a fallback mechanism.
     */
    it('should set isAvailable to false, log an error, and process jobs inline', async () => {
      await jest.isolateModules(async () => {
        const connectionError = new Error('Connection refused');
        
        jest.doMock('../config', () => ({
          config: { USE_REDIS: true, REDIS_URL: 'redis://bad-host:6379', TOKEN_ENCRYPTION_KEY: TEST_TOKEN_ENCRYPTION_KEY },
        }));

        const IORedis = require('ioredis');
        IORedis.mockImplementation(() => { throw connectionError; });

        const { processLogJob } = require('../jobs/logProcessor.job');
        processLogJob.mockResolvedValue({ result: 'inline-processed' });
        
        const { logger } = require('../utils/logger');
        const { QueueService } = require('../services/queue.service');

        const queueService = new QueueService();
        const payload = { data: 'inline-payload' };

        await queueService.init();
        const result = await queueService.addLogJob(payload);

        expect(logger.error).toHaveBeenCalledWith('Redis initialization failed. Webhooks will be processed inline.', { error: connectionError });
        expect(queueService.isAvailable).toBe(false);
        expect(processLogJob).toHaveBeenCalledWith(expect.objectContaining({ data: payload }));
        expect(result).toEqual({ queued: false, result: { result: 'inline-processed' } });
      });
    });
  });

  /**
   * Tests the behavior when Redis is explicitly disabled in the configuration.
   */
  describe('when Redis is disabled', () => {
    /**
     * Verifies that the service does not attempt to connect to Redis and processes
     * jobs synchronously (inline) by default.
     */
    it('should process jobs inline without attempting to connect', async () => {
      await jest.isolateModules(async () => {
        jest.doMock('../config', () => ({
          config: {
            USE_REDIS: false,
            TOKEN_ENCRYPTION_KEY: TEST_TOKEN_ENCRYPTION_KEY,
          },
        }));

        const { processLogJob } = require('../jobs/logProcessor.job');
        processLogJob.mockResolvedValue({ result: 'processed-without-redis' });

        const { QueueService } = require('../services/queue.service');
        const queueService = new QueueService();
        const payload = { data: 'no-redis-payload' };

        const result = await queueService.addLogJob(payload);

        expect(queueService.isAvailable).toBe(false);
        expect(processLogJob).toHaveBeenCalledWith(expect.objectContaining({ data: payload }));
        expect(result).toEqual({ queued: false, result: { result: 'processed-without-redis' } });
      });
    });
  });
});