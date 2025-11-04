import { HYPERLIQUID_API } from '@/config/hyperliquid';
import type { HyperliquidOrderbook, HyperliquidTrade } from '@/types/hyperliquid';

type OrderbookCallback = (orderbook: HyperliquidOrderbook) => void;
type TradesCallback = (trades: HyperliquidTrade[]) => void;
type UserCallback = (data: any) => void;
type AllMidsCallback = (mids: Record<string, string>) => void;

class HyperliquidWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions = new Map<string, Set<any>>();
  private isConnecting = false;
  private connectionTime: number = 0;
  private minConnectionTime = 5000; // Keep connection alive for at least 5 seconds
  private subscriptionDebounceTimer: NodeJS.Timeout | null = null;
  private activeSubscriptionCount = 0;

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return Promise.resolve();
    }

    // Don't reconnect if we still have the minimum connection time requirement
    const timeSinceConnection = Date.now() - this.connectionTime;
    if (this.ws && timeSinceConnection < this.minConnectionTime) {
      console.log('[HyperliquidWS] Connection too recent, reusing existing connection');
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(HYPERLIQUID_API.wsEndpoint);

        this.ws.onopen = () => {
          console.log('[HyperliquidWS] Connected');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          this.connectionTime = Date.now();
          this.resubscribeAll();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[HyperliquidWS] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[HyperliquidWS] Error:', error);
          this.isConnecting = false;
        };

        this.ws.onclose = () => {
          console.log('[HyperliquidWS] Disconnected');
          this.isConnecting = false;
          
          // Only reconnect if we have active subscriptions
          if (this.activeSubscriptionCount > 0) {
            this.handleReconnect();
          } else {
            console.log('[HyperliquidWS] No active subscriptions, not reconnecting');
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[HyperliquidWS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[HyperliquidWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((callbacks, key) => {
      if (key.startsWith('orderbook:')) {
        const market = key.split(':')[1];
        this.sendSubscribe('l2Book', { coin: market });
      } else if (key.startsWith('trades:')) {
        const market = key.split(':')[1];
        this.sendSubscribe('trades', { coin: market });
      } else if (key.startsWith('user:')) {
        const address = key.split(':')[1];
        this.sendSubscribe('user', { user: address });
      }
    });
  }

  private sendSubscribe(channel: string, params: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: channel,
          ...params
        }
      }));
    }
  }

  private sendUnsubscribe(channel: string, params: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'unsubscribe',
        subscription: {
          type: channel,
          ...params
        }
      }));
    }
  }

  private handleMessage(data: any): void {
    const { channel, data: messageData } = data;

    if (channel === 'l2Book' && messageData) {
      const key = `orderbook:${messageData.coin}`;
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.forEach(cb => cb(messageData));
      }
    } else if (channel === 'trades' && messageData) {
      const key = `trades:${messageData.coin}`;
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.forEach(cb => cb(messageData));
      }
    } else if (channel === 'user' && messageData) {
      const key = `user:${messageData.user}`;
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.forEach(cb => cb(messageData));
      }
    } else if (channel === 'allMids' && messageData) {
      const key = 'allMids';
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.forEach(cb => cb(messageData));
      }
    }
  }

  subscribeToOrderbook(market: string, callback: OrderbookCallback): () => void {
    this.connect();

    const key = `orderbook:${market}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      this.activeSubscriptionCount++;
      
      // Debounce subscription to prevent rapid subscribe/unsubscribe
      if (this.subscriptionDebounceTimer) {
        clearTimeout(this.subscriptionDebounceTimer);
      }
      
      this.subscriptionDebounceTimer = setTimeout(() => {
        this.sendSubscribe('l2Book', { coin: market });
      }, 100);
    }

    this.subscriptions.get(key)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
          this.activeSubscriptionCount--;
          
          // Debounce unsubscription
          if (this.subscriptionDebounceTimer) {
            clearTimeout(this.subscriptionDebounceTimer);
          }
          
          this.subscriptionDebounceTimer = setTimeout(() => {
            this.sendUnsubscribe('l2Book', { coin: market });
          }, 100);
        }
      }
    };
  }

  subscribeToTrades(market: string, callback: TradesCallback): () => void {
    this.connect();

    const key = `trades:${market}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      this.activeSubscriptionCount++;
      
      if (this.subscriptionDebounceTimer) {
        clearTimeout(this.subscriptionDebounceTimer);
      }
      
      this.subscriptionDebounceTimer = setTimeout(() => {
        this.sendSubscribe('trades', { coin: market });
      }, 100);
    }

    this.subscriptions.get(key)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
          this.activeSubscriptionCount--;
          
          if (this.subscriptionDebounceTimer) {
            clearTimeout(this.subscriptionDebounceTimer);
          }
          
          this.subscriptionDebounceTimer = setTimeout(() => {
            this.sendUnsubscribe('trades', { coin: market });
          }, 100);
        }
      }
    };
  }

  subscribeToUser(address: string, callback: UserCallback): () => void {
    this.connect();

    const key = `user:${address}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      this.activeSubscriptionCount++;
      
      if (this.subscriptionDebounceTimer) {
        clearTimeout(this.subscriptionDebounceTimer);
      }
      
      this.subscriptionDebounceTimer = setTimeout(() => {
        this.sendSubscribe('user', { user: address });
      }, 100);
    }

    this.subscriptions.get(key)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
          this.activeSubscriptionCount--;
          
          if (this.subscriptionDebounceTimer) {
            clearTimeout(this.subscriptionDebounceTimer);
          }
          
          this.subscriptionDebounceTimer = setTimeout(() => {
            this.sendUnsubscribe('user', { user: address });
          }, 100);
        }
      }
    };
  }

  subscribeToAllMids(callback: AllMidsCallback): () => void {
    this.connect();

    const key = 'allMids';
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      this.activeSubscriptionCount++;
      
      if (this.subscriptionDebounceTimer) {
        clearTimeout(this.subscriptionDebounceTimer);
      }
      
      this.subscriptionDebounceTimer = setTimeout(() => {
        this.sendSubscribe('allMids', {});
      }, 100);
    }

    this.subscriptions.get(key)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
          this.activeSubscriptionCount--;
          
          if (this.subscriptionDebounceTimer) {
            clearTimeout(this.subscriptionDebounceTimer);
          }
          
          this.subscriptionDebounceTimer = setTimeout(() => {
            this.sendUnsubscribe('allMids', {});
          }, 100);
        }
      }
    };
  }

  disconnect(): void {
    // Clear debounce timer
    if (this.subscriptionDebounceTimer) {
      clearTimeout(this.subscriptionDebounceTimer);
      this.subscriptionDebounceTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.activeSubscriptionCount = 0;
  }
}

export const hyperliquidWebSocketService = new HyperliquidWebSocketService();
