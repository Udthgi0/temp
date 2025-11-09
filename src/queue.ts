import { Queue, Worker, Job } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';

export interface OrderJobData {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
}

export const QUEUE_NAME = 'order-processing';

// --- Create the Redis Connection (Handles both Local and Prod) ---

let redisConnection: Redis;

const commonOptions: RedisOptions = {
  maxRetriesPerRequest: null, // This is required for BullMQ
};

if (process.env.REDIS_URL) {
  // --- Production: Use the URL provided by Render ---
  // ioredis is smart enough to parse the URL and handle TLS automatically
  console.log('[Queue] REDIS_URL found, connecting to Render Redis.');
  redisConnection = new Redis(process.env.REDIS_URL, {
    ...commonOptions,
    // Add TLS options required by Render
    tls: {
      rejectUnauthorized: false
    }
  });
} else {
  // --- Local: Use localhost ---
  console.log('[Queue] No REDIS_URL found, connecting to localhost.');
  redisConnection = new Redis({
    ...commonOptions,
    host: 'localhost',
    port: 6379,
  });
}

redisConnection.on('connect', () => console.log('[Queue] Redis connected.'));
redisConnection.on('error', (err) => console.error('[Queue] Redis connection error:', err));

// --- End of new connection logic ---


export const orderQueue = new Queue<OrderJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const initializeWorker = (processor: (job: Job<OrderJobData>) => Promise<any>) => {
  const worker = new Worker<OrderJobData>(QUEUE_NAME, processor, {
    connection: redisConnection,
    concurrency: 10,
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} (Order ${job.data.orderId}) has completed!`);
  });

  worker.on('failed', (job, err) => {
    console.log(`[Worker] Job ${job?.id ?? 'unknown'} (Order ${job?.data?.orderId ?? 'unknown'}) has failed with ${err.message}`);
  });
};
