import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { randomUUID } from 'crypto';
import { orderQueue, type OrderJobData, initializeWorker } from './queue.js';
import { connectionManager } from './connectionManager.js';
import { runOrderProcessor } from './worker.js';
import type { FastifyRequest } from 'fastify';
import { createOrderTable } from './db.js';

interface IOrderRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
}

interface WebSocketQuery {
  orderId?: string;
}

const fastify = Fastify({
  logger: true,
});

await fastify.register(websocketPlugin);

await fastify.register(async function (fastify) {
  
  fastify.post<{ Body: IOrderRequest }>('/api/orders/execute', async (req, reply) => {
    const orderDetails = req.body;
    const orderId = randomUUID();

    console.log(`[Order ${orderId}] HTTP POST Received:`, orderDetails);

    const jobData: OrderJobData = {
      orderId,
      ...orderDetails,
    };
    
    await orderQueue.add(orderId, jobData);
    console.log(`[Order ${orderId}] Added to queue`);

    return { orderId };
  });

  fastify.get(
    '/api/orders/execute',
    { websocket: true },
    (connection: any, req: FastifyRequest) => {
      const query = req.query as WebSocketQuery;
      const orderId = query.orderId;

      if (!orderId) {
        connection.send(
          JSON.stringify({ error: 'orderId query parameter is required' })
        );
        connection.socket.close();
        return;
      }
      connectionManager.add(orderId, connection.socket);

      connection.send(
        JSON.stringify({
          orderId,
          status: 'pending',
          message: 'Order received, WebSocket connected.',
        })
      );

      connection.on('message', (message: any) => {
        console.log(`[Order ${orderId}] Received message: ${message}`);
      });

      connection.on('close', () => {
        // --- Remove connection from manager on disconnect ---
        connectionManager.remove(orderId);
      });

      connection.on('error', (err: any) => {
        console.log(`[Order ${orderId}] WebSocket error:`, err);
        connectionManager.remove(orderId);
      });
    }
  );
});

const start = async () => {
  try {
    await createOrderTable(); 
    initializeWorker(runOrderProcessor);
    
    await fastify.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
