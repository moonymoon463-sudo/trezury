import type { DydxOrderbook } from "@/types/dydx";

type OrderbookCallback = (orderbook: DydxOrderbook) => void;
type TradeCallback = (trade: any) => void;
type CandleCallback = (candle: any) => void;
type HealthCallback = (state: { 
  isConnected: boolean; 
  reconnectAttempts: number; 
  maxAttempts: number 
}) => void;

class DydxWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000; // Max 30 seconds
  private subscriptions = new Map<string, Set<OrderbookCallback>>();
  private tradeSubscriptions = new Map<string, Set<TradeCallback>>();
  private candleSubscriptions = new Map<string, Set<CandleCallback>>();
  private healthCallbacks = new Set<HealthCallback>();
  private isConnecting = false;
  private orderbookState = new Map<string, { bids: Map<number, string>; asks: Map<number, string> }>();
  private lastMessageId = new Map<string, string>(); // For deduplication
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPongTime = Date.now();

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;
    console.log('[DydxWS] Connecting...');

    this.ws = new WebSocket('wss://indexer.dydx.trade/v4/ws');

    this.ws.onopen = () => {
      console.log('[DydxWS] Connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay
      this.lastPongTime = Date.now();
      this.notifyHealthCallbacks();
      this.resubscribeAll();
      this.startHeartbeat();
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
      this.stopHeartbeat();
      this.notifyHealthCallbacks();
      this.attemptReconnect();
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DydxWS] Max reconnect attempts reached');
      this.notifyHealthCallbacks();
      return;
    }

    this.reconnectAttempts++;
    this.notifyHealthCallbacks();
    
    // Exponential backoff with cap
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    console.log(`[DydxWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Check if last pong was received within 60 seconds
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        if (timeSinceLastPong > 60000) {
          console.warn('[DydxWS] Heartbeat timeout, reconnecting...');
          this.ws.close();
          return;
        }
        
        // Send ping (dYdX doesn't have a formal ping, but we can track message flow)
        this.lastPongTime = Date.now();
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private notifyHealthCallbacks(): void {
    const state = {
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    };
    this.healthCallbacks.forEach(cb => cb(state));
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((_, market) => {
      this.sendSubscribe('v4_orderbook', market);
    });
    this.tradeSubscriptions.forEach((_, market) => {
      this.sendSubscribe('v4_trades', market);
    });
    this.candleSubscriptions.forEach((_, key) => {
      const [market, resolution] = key.split('_');
      this.sendSubscribe('v4_candles', market, resolution);
    });
  }

  private sendSubscribe(channel: string, id: string, resolution?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // For candles, id must be "MARKET/RESOLUTION" per dYdX v4 docs
      const subscriptionId = channel === 'v4_candles' && resolution
        ? `${id}/${resolution}`
        : id;
      
      const message = {
        type: 'subscribe',
        channel,
        id: subscriptionId,
      };
      
      this.ws.send(JSON.stringify(message));
      console.log(`[DydxWS] Subscribed to ${channel}:${subscriptionId}`);
    }
  }

  private sendUnsubscribe(channel: string, id: string, resolution?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // For candles, id must be "MARKET/RESOLUTION" per dYdX v4 docs
      const subscriptionId = channel === 'v4_candles' && resolution
        ? `${id}/${resolution}`
        : id;
      
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        channel,
        id: subscriptionId,
      }));
      console.log(`[DydxWS] Unsubscribed from ${channel}:${subscriptionId}`);
    }
  }

  private handleMessage(message: any): void {
    if (message.type !== 'channel_data') return;

    const { channel, id, contents } = message;

    // Message deduplication
    const messageKey = `${channel}:${id}:${JSON.stringify(contents).substring(0, 50)}`;
    if (this.lastMessageId.get(channel) === messageKey) {
      return; // Skip duplicate
    }
    this.lastMessageId.set(channel, messageKey);

    if (channel === 'v4_orderbook') {
      // Get or initialize state for this market
      const state = this.orderbookState.get(id) ?? { bids: new Map(), asks: new Map() };

      // Merge bids (delta updates)
      if (Array.isArray(contents.bids)) {
        for (const [p, s] of contents.bids) {
          const price = Number(p);
          const size = String(s);
          if (!isFinite(price)) continue;
          if (Number(size) <= 0) {
            state.bids.delete(price);
          } else {
            state.bids.set(price, size);
          }
        }
      }

      // Merge asks (delta updates)
      if (Array.isArray(contents.asks)) {
        for (const [p, s] of contents.asks) {
          const price = Number(p);
          const size = String(s);
          if (!isFinite(price)) continue;
          if (Number(size) <= 0) {
            state.asks.delete(price);
          } else {
            state.asks.set(price, size);
          }
        }
      }

      // Rebuild sorted arrays from merged state
      const bidsArr = Array.from(state.bids.entries())
        .map(([price, size]) => ({ price: price.toString(), size }))
        .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

      const asksArr = Array.from(state.asks.entries())
        .map(([price, size]) => ({ price: price.toString(), size }))
        .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

      // Save state
      this.orderbookState.set(id, state);

      // Emit merged orderbook
      const orderbook: DydxOrderbook = {
        market: id,
        bids: bidsArr,
        asks: asksArr,
        lastUpdated: Date.now(),
      };

      const callbacks = this.subscriptions.get(id);
      callbacks?.forEach(cb => cb(orderbook));
    }

    if (channel === 'v4_trades') {
      const callbacks = this.tradeSubscriptions.get(id);
      callbacks?.forEach(cb => cb(contents));
    }

    if (channel === 'v4_candles') {
      // Extract market and resolution from id (format: "BTC-USD/1HOUR")
      const [market, resolution] = id.split('/');
      const key = `${market}_${resolution}`;
      
      // Transform dYdX API format to our DydxCandle format
      try {
        const transformedCandle = {
          timestamp: new Date(contents.startedAt).getTime() / 1000, // Unix seconds
          open: parseFloat(contents.open),
          high: parseFloat(contents.high),
          low: parseFloat(contents.low),
          close: parseFloat(contents.close),
          volume: parseFloat(contents.baseTokenVolume || '0'),
        };
        
        // Validate before sending to callbacks
        if (
          isFinite(transformedCandle.timestamp) &&
          isFinite(transformedCandle.open) &&
          isFinite(transformedCandle.high) &&
          isFinite(transformedCandle.low) &&
          isFinite(transformedCandle.close) &&
          transformedCandle.timestamp > 0
        ) {
          const callbacks = this.candleSubscriptions.get(key);
          callbacks?.forEach(cb => cb(transformedCandle));
        } else {
          console.warn('[DydxWS] Invalid candle data from WebSocket:', contents);
        }
      } catch (error) {
        console.error('[DydxWS] Error transforming candle:', error, contents);
      }
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

  subscribeToCandles(market: string, resolution: string, callback: CandleCallback): () => void {
    this.connect();

    const key = `${market}_${resolution}`;
    if (!this.candleSubscriptions.has(key)) {
      this.candleSubscriptions.set(key, new Set());
      this.sendSubscribe('v4_candles', market, resolution);
    }

    this.candleSubscriptions.get(key)!.add(callback);

    return () => {
      const callbacks = this.candleSubscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.candleSubscriptions.delete(key);
          // Extract resolution from key (format: "BTC-USD_1HOUR")
          const [marketName, res] = key.split('_');
          this.sendUnsubscribe('v4_candles', marketName, res);
        }
      }
    };
  }

  subscribeToHealth(callback: HealthCallback): () => void {
    this.healthCallbacks.add(callback);
    // Immediately notify of current state
    callback({
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    });

    return () => {
      this.healthCallbacks.delete(callback);
    };
  }

  getConnectionState(): { isConnected: boolean; reconnectAttempts: number } {
    return {
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.subscriptions.clear();
    this.tradeSubscriptions.clear();
    this.candleSubscriptions.clear();
    this.healthCallbacks.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const dydxWebSocketService = new DydxWebSocketService();
