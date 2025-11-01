/**
 * Shared types for all exchange adapters
 * Provides a common interface for multi-exchange support
 */

export type OrderSide = 'long' | 'short' | 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'PO';

export interface BaseOrder {
  market: string;
  side: OrderSide;
  type: OrderType;
  size: number;
  price?: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: TimeInForce;
  reduceOnly?: boolean;
  postOnly?: boolean;
}

export interface OrderResult {
  orderId: string;
  status: OrderStatus;
  filled: number;
  remaining: number;
  avgPrice?: number;
  timestamp: number;
}

export interface Position {
  market: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  leverage: number;
  margin: number;
  marginRatio: number;
  timestamp: number;
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue?: number;
}

export interface Market {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  type: 'spot' | 'perp' | 'future';
  tickSize: number;
  stepSize: number;
  minOrderSize: number;
  maxOrderSize: number;
  minNotional: number;
  maxLeverage: number;
  fundingRate?: number;
  nextFundingTime?: number;
  markPrice: number;
  indexPrice: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  change24h: number;
}

export interface OrderbookLevel {
  price: number;
  size: number;
  total?: number;
}

export interface Orderbook {
  market: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}

export interface Trade {
  id: string;
  market: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExchangeConfig {
  name: string;
  type: 'cex' | 'dex';
  chain?: 'solana' | 'ethereum' | 'arbitrum';
  apiUrl: string;
  wsUrl?: string;
  testnet?: boolean;
}

/**
 * Base interface all exchange adapters must implement
 */
export interface IExchangeAdapter {
  config: ExchangeConfig;
  
  // Market Data
  getMarkets(): Promise<Market[]>;
  getMarket(symbol: string): Promise<Market>;
  getOrderbook(symbol: string, depth?: number): Promise<Orderbook>;
  getTrades(symbol: string, limit?: number): Promise<Trade[]>;
  getCandles(symbol: string, interval: string, limit?: number): Promise<Candle[]>;
  
  // Account (requires auth)
  getBalances(): Promise<Balance[]>;
  getPositions(): Promise<Position[]>;
  getPosition(market: string): Promise<Position | null>;
  
  // Trading (requires auth)
  placeOrder(order: BaseOrder): Promise<OrderResult>;
  cancelOrder(orderId: string, market: string): Promise<boolean>;
  closePosition(market: string, size?: number): Promise<OrderResult>;
  
  // WebSocket (optional)
  subscribe?(channels: string[], callback: (data: any) => void): void;
  unsubscribe?(channels: string[]): void;
  disconnect?(): void;
}

export interface ExchangeError {
  code: string;
  message: string;
  details?: any;
}
