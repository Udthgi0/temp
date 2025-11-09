import { describe, test, expect } from '@jest/globals';
import { mockDexRouter } from './mockDexRouter.js';

export interface DexQuote {
  dex: string;
  price: number;
  fee: number;
  amountOut: number;
}
describe('MockDexRouter', () => {
  test('should return a valid quote from Raydium', async () => {
    const quote = await mockDexRouter.getRaydiumQuote('SOL', 'USDC', 10);
    expect(quote.dex).toBe('Raydium');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.amountOut).toBeGreaterThan(0);
  });

  test('should return a valid quote from Meteora', async () => {
    const quote = await mockDexRouter.getMeteoraQuote('SOL', 'USDC', 10);
    expect(quote.dex).toBe('Meteora');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.amountOut).toBeGreaterThan(0);
  });

  test('should execute a swap and return a mock txHash', async () => {
    const order = { orderId: 'test-123', tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 10 };
    const result = await mockDexRouter.executeSwap('Raydium', order, 150);
    expect(result.txHash).toBeDefined();
    expect(result.txHash.startsWith('Tx')).toBe(true);
  });
});