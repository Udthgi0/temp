import { Queue, Worker, Job } from 'bullmq';
import { Redis, RedisOptions } from 'ioredis'; // Cleaned up imports

export interface OrderJobData {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
}

export const QUEUE_NAME = 'order-processing';

// --- Create the Redis Connection (Handles both Local and Prod) ---

const connectionOptions: RedisOptions = {
  maxRetriesPerRequest: null, // This is required for BullMQ
};

if (process.env.REDIS_URL) {
  // --- Production: Use the URL provided by Render ---
  // Parse the Render URL to get connection options
  const redisUrl = new URL(process.env.REDIS_URL);
  
  connectionOptions.host = redisUrl.hostname;
  connectionOptions.port = parseInt(redisUrl.port);
  connectionOptions.password = redisUrl.password;
  // Add TLS for Render Redis
  connectionOptions.tls = {
    requestCert: true,
    rejectUnauthorized: false // Or true depending on your cert setup, but false is common
  };
  
} else {
  // --- Local: Use localhost ---
  console.log('[Queue] No REDIS_URL found, connecting to localhost.');
  connectionOptions.host = 'localhost';
  connectionOptions.port = 6379;
}

const redisConnection = new Redis(connectionOptions);

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
    // Added null checks just in case a job fails very early
    console.log(`[Worker] Job ${job?.id ?? 'unknown'} (Order ${job?.data?.orderId ?? 'unknown'}) has failed with ${err.message}`);
  });
};
