import { Pool } from 'pg'; 
import type{ OrderJobData } from './queue.js';

export const pool = new Pool({
  user: 'postgres', 
  host: 'localhost',
  database: 'postgres', 
  password: 'mysecretpassword', 
  port: 5433,
});


const createStatusEnum = async () => {
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE order_status AS ENUM ('confirmed', 'failed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log('[DB] "order_status" enum ensured');
};

export const createOrderTable = async () => {
  await createStatusEnum();
  
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_id UUID NOT NULL UNIQUE,
      status order_status NOT NULL,
      token_in VARCHAR(10) NOT NULL,
      token_out VARCHAR(10) NOT NULL,
      amount_in NUMERIC NOT NULL,
      chosen_dex VARCHAR(20),
      tx_hash VARCHAR(100) UNIQUE,
      executed_price NUMERIC,
      amount_out NUMERIC,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(createTableQuery);
  console.log('[DB] "orders" table ensured');
};

// --- Save a Successful Order ---
export const saveConfirmedOrder = async (jobData: OrderJobData, result: any) => {
  const query = `
    INSERT INTO orders (
      order_id, status, token_in, token_out, amount_in, 
      chosen_dex, tx_hash, executed_price, amount_out
    ) VALUES ($1, 'confirmed', $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (order_id) DO NOTHING;
  `;
  
  const values = [
    jobData.orderId,
    jobData.tokenIn,
    jobData.tokenOut,
    jobData.amountIn,
    result.dex, 
    result.txHash,
    result.executedPrice,
    result.amountOut
  ];

  await pool.query(query, values);
  console.log(`[DB] Saved CONFIRMED order ${jobData.orderId}`);
};

export const saveFailedOrder = async (jobData: OrderJobData, error: Error) => {
  const query = `
    INSERT INTO orders (
      order_id, status, token_in, token_out, amount_in, error_message
    ) VALUES ($1, 'failed', $2, $3, $4, $5)
    ON CONFLICT (order_id) DO NOTHING;
  `;
  
  const values = [
    jobData.orderId,
    jobData.tokenIn,
    jobData.tokenOut,
    jobData.amountIn,
    error.message
  ];

  await pool.query(query, values);
  console.log(`[DB] Saved FAILED order ${jobData.orderId}`);
};