import { Queue, Worker } from 'bullmq';

import { Redis } from 'ioredis';
import IORedis from 'ioredis';

export interface OrderJobData {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
}

export const QUEUE_NAME = 'order-processing';

const redisConnection = new Redis(process.env.REDIS_URL, { // Render provides this
  maxRetriesPerRequest: null,
});
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

export const initializeWorker = (processor: (job: any) => Promise<any>) => {
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
