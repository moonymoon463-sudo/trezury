export interface DydxMarket {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  fundingRate?: number;
  nextFundingTime?: number | null;
  lastUpdated: number;
}

export interface DydxOrderbook {
  market: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  lastUpdated: number;
}

export interface DydxCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DydxTrade {
  id: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  timestamp: number;
}

export interface DydxPosition {
  market: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export type DydxOperation =
  | 'get_markets'
  | 'get_orderbook'
  | 'get_candles'
  | 'get_trades'
  | 'get_positions'
  | 'get_funding';

export interface DydxRequest {
  operation: DydxOperation;
  params?: {
    market?: string;
    address?: string;
    resolution?: string;
    limit?: number;
  };
}
