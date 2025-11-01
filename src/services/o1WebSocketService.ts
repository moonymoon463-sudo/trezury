/**
 * 01 Protocol WebSocket Service
 * Manages real-time market data streams
 */

type SubscriptionCallback = (data: any) => void;

interface Subscription {
  channel: string;
  symbol?: string;
  callback: SubscriptionCallback;
}

class O1WebSocketService {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private healthCheckInterval: number | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    console.log('[O1WebSocket] Connecting to 01 Protocol WebSocket...');

    try {
      // 01 Protocol WebSocket endpoint
      this.ws = new WebSocket('wss://api.01.xyz/v1/ws');

      this.ws.onopen = () => {
        console.log('[O1WebSocket] Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHealthCheck();
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[O1WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[O1WebSocket] Error:', error);
      };

      this.ws.onclose = () => {
        console.log('[O1WebSocket] Connection closed');
        this.isConnecting = false;
        this.stopHealthCheck();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('[O1WebSocket] Connection failed:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[O1WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[O1WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHealthCheck() {
    this.stopHealthCheck();
    this.healthCheckInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private handleMessage(data: any) {
    const { type, channel, symbol, ...payload } = data;

    // Handle pong response
    if (type === 'pong') {
      return;
    }

    // Route message to appropriate subscribers
    const key = symbol ? `${channel}:${symbol}` : channel;
    const subs = this.subscriptions.get(key);

    if (subs) {
      subs.forEach(sub => {
        try {
          sub.callback(payload);
        } catch (error) {
          console.error('[O1WebSocket] Callback error:', error);
        }
      });
    }
  }

  private resubscribeAll() {
    console.log('[O1WebSocket] Resubscribing to all channels');
    this.subscriptions.forEach((subs, key) => {
      const [channel, symbol] = key.split(':');
      this.sendSubscription(channel, symbol);
    });
  }

  private sendSubscription(channel: string, symbol?: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[O1WebSocket] Cannot subscribe - not connected');
      return;
    }

    const message = {
      type: 'subscribe',
      channel,
      ...(symbol && { symbol }),
    };

    console.log('[O1WebSocket] Subscribing:', message);
    this.ws.send(JSON.stringify(message));
  }

  private sendUnsubscription(channel: string, symbol?: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'unsubscribe',
      channel,
      ...(symbol && { symbol }),
    };

    console.log('[O1WebSocket] Unsubscribing:', message);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Subscribe to market ticker updates
   */
  subscribeToTicker(symbol: string, callback: SubscriptionCallback): () => void {
    return this.subscribe('ticker', callback, symbol);
  }

  /**
   * Subscribe to orderbook updates
   */
  subscribeToOrderbook(symbol: string, callback: SubscriptionCallback): () => void {
    return this.subscribe('orderbook', callback, symbol);
  }

  /**
   * Subscribe to recent trades
   */
  subscribeToTrades(symbol: string, callback: SubscriptionCallback): () => void {
    return this.subscribe('trades', callback, symbol);
  }

  /**
   * Subscribe to funding rate updates
   */
  subscribeToFunding(symbol: string, callback: SubscriptionCallback): () => void {
    return this.subscribe('funding', callback, symbol);
  }

  /**
   * Generic subscribe method
   */
  private subscribe(channel: string, callback: SubscriptionCallback, symbol?: string): () => void {
    const key = symbol ? `${channel}:${symbol}` : channel;
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, []);
      this.sendSubscription(channel, symbol);
    }

    const subscription: Subscription = { channel, symbol, callback };
    this.subscriptions.get(key)!.push(subscription);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(key);
      if (!subs) return;

      const index = subs.indexOf(subscription);
      if (index > -1) {
        subs.splice(index, 1);
      }

      if (subs.length === 0) {
        this.subscriptions.delete(key);
        this.sendUnsubscription(channel, symbol);
      }
    };
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    console.log('[O1WebSocket] Disconnecting...');
    this.stopHealthCheck();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.subscriptions.clear();
  }
}

// Singleton instance
export const o1WebSocketService = new O1WebSocketService();
