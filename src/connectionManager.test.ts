import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { connectionManager } from './connectionManager.js';
import { WebSocket } from 'ws'; 


class MockWebSocket {
  readyState: number = WebSocket.OPEN;
  send = jest.fn();
  close = jest.fn();
  
  simulateClose() {
    this.readyState = WebSocket.CLOSED;
  }
}

describe('ConnectionManager', () => {

  let mockSocket: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = new MockWebSocket();
    connectionManager.clear();
  });

  test('should add a new connection', () => {
    connectionManager.add('order-1', mockSocket as any);
    expect(connectionManager.get('order-1')).toBe(mockSocket);
  });

  test('should retrieve an existing connection', () => {
    connectionManager.add('order-1', mockSocket as any);
    const conn = connectionManager.get('order-1');
    expect(conn).toBeDefined();
    expect(conn).toBe(mockSocket);
  });

  test('should return undefined for a non-existent connection', () => {
    const conn = connectionManager.get('order-nonexistent');
    expect(conn).toBeUndefined();
  });

  test('should remove a connection', () => {
    connectionManager.add('order-1', mockSocket as any);
    expect(connectionManager.get('order-1')).toBe(mockSocket);
    
    connectionManager.remove('order-1');
    expect(connectionManager.get('order-1')).toBeUndefined();
  });
  test('should not throw when removing a non-existent connection', () => {
    expect(() => {
      connectionManager.remove('order-nonexistent');
    }).not.toThrow();
  });

  test('should send a message to an open connection', () => {
    connectionManager.add('order-1', mockSocket as any);
    const payload = { status: 'confirmed' };
    
    connectionManager.send('order-1', payload);
    
    expect(mockSocket.send).toHaveBeenCalledTimes(1);
    expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify(payload));
  });

  test('should not send a message to a closed connection', () => {
    mockSocket.simulateClose(); 
    connectionManager.add('order-1', mockSocket as any);
    
    connectionManager.send('order-1', { status: 'confirmed' });
    
    expect(mockSocket.send).not.toHaveBeenCalled();
  });

  test('should not throw when sending to a non-existent connection', () => {
    expect(() => {
      connectionManager.send('order-nonexistent', { status: 'confirmed' });
    }).not.toThrow();
    
    expect(mockSocket.send).not.toHaveBeenCalled();
  });

});