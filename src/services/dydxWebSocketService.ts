import type { DydxOrderbook } from "@/types/dydx";

type OrderbookCallback = (orderbook: DydxOrderbook) => void;
type TradeCallback = (trade: any) => void;

class DydxWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions = new Map<string, Set<OrderbookCallback>>();
  private tradeSubscriptions = new Map<string, Set<TradeCallback>>();
  private isConnecting = false;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;
    console.log('[DydxWS] Connecting...');

    this.ws = new WebSocket('wss://indexer.dydx.trade/v4/ws');

    this.ws.onopen = () => {
      console.log('[DydxWS] Connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[DydxWS] Parse error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[DydxWS] Error:', error);
    };

    this.ws.onclose = () => {
      console.log('[DydxWS] Disconnected');
      this.isConnecting = false;
      this.attemptReconnect();
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DydxWS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[DydxWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => this.connect(), delay);
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((_, market) => {
      this.sendSubscribe('v4_orderbook', market);
    });
    this.tradeSubscriptions.forEach((_, market) => {
      this.sendSubscribe('v4_trades', market);
    });
  }

  private sendSubscribe(channel: string, id: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channel,
        id,
      }));
      console.log(`[DydxWS] Subscribed to ${channel}:${id}`);
    }
  }

  private sendUnsubscribe(channel: string, id: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        channel,
        id,
      }));
      console.log(`[DydxWS] Unsubscribed from ${channel}:${id}`);
    }
  }

  private handleMessage(message: any): void {
    if (message.type !== 'channel_data') return;

    const { channel, id, contents } = message;

    if (channel === 'v4_orderbook') {
      const orderbook: DydxOrderbook = {
        market: id,
        bids: contents.bids?.map((b: any) => ({ price: b[0], size: b[1] })) || [],
        asks: contents.asks?.map((a: any) => ({ price: a[0], size: a[1] })) || [],
        lastUpdated: Date.now(),
      };

      const callbacks = this.subscriptions.get(id);
      callbacks?.forEach(cb => cb(orderbook));
    }

    if (channel === 'v4_trades') {
      const callbacks = this.tradeSubscriptions.get(id);
      callbacks?.forEach(cb => cb(contents));
    }
  }

  subscribeToOrderbook(market: string, callback: OrderbookCallback): () => void {
    this.connect();

    if (!this.subscriptions.has(market)) {
      this.subscriptions.set(market, new Set());
      this.sendSubscribe('v4_orderbook', market);
    }

    this.subscriptions.get(market)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(market);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(market);
          this.sendUnsubscribe('v4_orderbook', market);
        }
      }
    };
  }

  subscribeToTrades(market: string, callback: TradeCallback): () => void {
    this.connect();

    if (!this.tradeSubscriptions.has(market)) {
      this.tradeSubscriptions.set(market, new Set());
      this.sendSubscribe('v4_trades', market);
    }

    this.tradeSubscriptions.get(market)!.add(callback);

    return () => {
      const callbacks = this.tradeSubscriptions.get(market);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.tradeSubscriptions.delete(market);
          this.sendUnsubscribe('v4_trades', market);
        }
      }
    };
  }

  disconnect(): void {
    this.subscriptions.clear();
    this.tradeSubscriptions.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const dydxWebSocketService = new DydxWebSocketService();
