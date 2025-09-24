import {Job, Queue, Worker} from 'bullmq';
import IORedis from 'ioredis';
import {config} from '../config';
import {logger} from '../utils/logger';
import {processLogJob} from '../jobs/logProcessor.job';

const QUEUE_NAME = 'log-processing';

/**
 * QueueService manages background processing of webhook logs using BullMQ.
 *
 * Design decisions:
 * - Initialization is lazy so tests can instantiate the class without
 *   opening Redis connections or starting background workers.
 * - If Redis is unavailable, the service falls back to inline processing
 *   to preserve webhook handling correctness.
 */
export class QueueService {
  public logQueue: Queue | null = null;
  private worker: Worker | null = null;
  private redisClient: IORedis | null = null;
  public isAvailable: boolean = false;
  private initialized: boolean = false;

  constructor() {
    if (!config.USE_REDIS) {
      logger.info('Redis is not configured. Webhooks will be processed inline.');
    }
  }

  public async init() {
    await this.ensureInitialized();
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;

    if (config.USE_REDIS && config.REDIS_URL) {
      try {
        this.redisClient = new IORedis(config.REDIS_URL, {
          maxRetriesPerRequest: null,
        });

        this.logQueue = new Queue(QUEUE_NAME, { connection: this.redisClient });

        // Limit concurrency and rate to avoid overwhelming downstream services
        this.worker = new Worker(QUEUE_NAME, processLogJob, {
          connection: this.redisClient,
          concurrency: 2, // Limit concurrent jobs
          limiter: {
            max: 10, // Max jobs per duration
            duration: 1000, // Per second
          },
        });
        this.worker.on('failed', (job: Job | undefined, err: Error) => {
          logger.error(`Job ${job?.id} failed`, { error: err.message, stack: err.stack });
        });
        this.worker.on('completed', (job: Job) => {
          logger.info(`Job ${job.id} completed successfully.`);
        });

        this.isAvailable = true;
        logger.info('Connected to Redis and started BullMQ worker.');
      } catch (error) {
        logger.error('Redis initialization failed. Webhooks will be processed inline.', { error });
        await this.cleanup();
      }
    } else {
      logger.info('Redis is not configured. Webhooks will be processed inline.');
    }
  }

  async cleanup() {
    try {
      if (this.worker) {
        await this.worker.close();
        this.worker = null;
      }
      if (this.logQueue) {
        await this.logQueue.close();
        this.logQueue = null;
      }
      if (this.redisClient) {
        this.redisClient.disconnect();
        this.redisClient = null;
      }
      this.isAvailable = false;
    } catch (error) {
      logger.error('Error during queue service cleanup', { error });
    }
  }

  async addLogJob(payload: any) {
    await this.ensureInitialized();

    if (this.isAvailable && this.logQueue) {
      const job = await this.logQueue.add('process-log-job', payload);
      return { queued: true, jobId: job.id };
    } else {
      // Fallback: process inline if Redis is not available. This keeps webhook
      // handling resilient but means processing happens synchronously in the
      // request lifecycle.
      logger.warn('Processing webhook inline due to unavailable queue.');
      const fakeJob = { id: `inline-${Date.now()}`, data: payload };
      const result = await processLogJob(fakeJob as Job);
      return { queued: false, result };
    }
  }
}