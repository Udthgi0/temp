import { WebSocket } from 'ws';

const connectionMap = new Map<string, WebSocket>();

export const connectionManager = {
    clear() {
    connectionMap.clear();
  },
  
  /**
  
   * @param orderId 
   * @param socket
   */
  add(orderId: string, socket: WebSocket) {
    connectionMap.set(orderId, socket);
    console.log(`[ConnManager] Connection added for order ${orderId}. Total connections: ${connectionMap.size}`);
  },

  /**
   
   * @param orderId 
   */
  remove(orderId: string) {
    connectionMap.delete(orderId);
    console.log(`[ConnManager] Connection removed for order ${orderId}. Total connections: ${connectionMap.size}`);
  },

  /**
  
   * @param orderId 
   * @returns 
   */
  get(orderId: string): WebSocket | undefined {
    return connectionMap.get(orderId);
  },

  /**
  
   * @param orderId 
   * @param payload 
   */
  send(orderId: string, payload: any) {
    const connection = this.get(orderId);
    
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify(payload));
    } else {
      console.log(`[ConnManager] No open connection found for order ${orderId} to send payload.`);
    }
  },
};