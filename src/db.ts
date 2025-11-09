import { Pool, type PoolConfig } from 'pg'; // Import PoolConfig
import type { OrderJobData } from './queue.js';

// --- Database Connection Pool (Handles both Local and Prod) ---

// Start with a base config object
const dbConfig: PoolConfig = {};

if (process.env.DATABASE_URL) {
  // --- Production: Use the URL provided by Render ---
  console.log('[DB] DATABASE_URL found, connecting to Render Postgres.');
  dbConfig.connectionString = process.env.DATABASE_URL;
  dbConfig.ssl = { // We need to add SSL for Render's Postgres
    rejectUnauthorized: false,
  };
} else {
  // --- Local: Use localhost ---
  console.log('[DB] No DATABASE_URL found, connecting to localhost.');
  dbConfig.user = 'postgres';
  dbConfig.host = 'localhost';
  dbConfig.database = 'postgres';
  dbConfig.password = 'mysecretpassword';
  dbConfig.port = 5433; // Your local Docker port
  // We simply don't add the ssl property for local
}

const pool = new Pool(dbConfig);

pool.on('connect', () => console.log('[DB] Postgres connected.'));
pool.on('error', (err) => console.error('[DB] Postgres connection error:', err));

// --- End of new connection logic ---


// --- Create Order Status Enum Type ---
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

// --- Create the 'orders' Table ---
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

// --- Save a Failed Order ---
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

// Export the pool so setup file can close it
export { pool };
