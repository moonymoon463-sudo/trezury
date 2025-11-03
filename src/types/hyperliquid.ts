export type HyperliquidOrderSide = 'BUY' | 'SELL';
export type HyperliquidOrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';
export type HyperliquidOrderStatus = 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'FAILED';
export type HyperliquidTimeInForce = 'GTC' | 'IOC' | 'ALO';
export type HyperliquidPositionSide = 'LONG' | 'SHORT';
export type HyperliquidPositionStatus = 'OPEN' | 'CLOSED' | 'LIQUIDATED';

export interface HyperliquidMarket {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
}

export interface HyperliquidPosition {
  coin: string;
  szi: string; // Signed size (negative = short)
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  marginUsed: string;
  maxTradeSzs: [string, string];
}

export interface HyperliquidAssetPosition {
  position: HyperliquidPosition;
  type: 'oneWay';
}

export interface HyperliquidCrossMarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
}

export interface HyperliquidAccountState {
  assetPositions: HyperliquidAssetPosition[];
  crossMarginSummary: HyperliquidCrossMarginSummary;
  marginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  withdrawable: string;
}

export interface HyperliquidOrder {
  coin: string;
  side: 'B' | 'A'; // Buy/Ask
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  origSz: string;
  cloid?: string;
}

export interface HyperliquidFill {
  coin: string;
  px: string;
  sz: string;
  side: 'B' | 'A';
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
  feeToken: string;
}

export interface HyperliquidOrderRequest {
  market: string;
  side: HyperliquidOrderSide;
  type: HyperliquidOrderType;
  size: number;
  price?: number;
  leverage: number;
  reduceOnly?: boolean;
  postOnly?: boolean;
  timeInForce?: HyperliquidTimeInForce;
  clientOrderId?: string;
}

export interface HyperliquidOrderResponse {
  success: boolean;
  order?: {
    id: string;
    orderId: number;
    clientOrderId: string;
    market: string;
    side: HyperliquidOrderSide;
    type: HyperliquidOrderType;
    size: number;
    price?: number;
    status: HyperliquidOrderStatus;
  };
  txHash?: string;
  error?: string;
  errorCode?: string;
}

export interface HyperliquidLevel {
  px: string;
  sz: string;
  n: number;
}

export interface HyperliquidOrderbook {
  coin: string;
  levels: [HyperliquidLevel[], HyperliquidLevel[]]; // [bids, asks]
  time: number;
}

export interface HyperliquidTrade {
  coin: string;
  side: string;
  px: string;
  sz: string;
  hash: string;
  time: number;
  tid: number;
}

// Hyperliquid API returns candleSnapshot as: [[timestamp, open, high, low, close, volume], ...]
// This interface represents the transformed format we use in the app
export interface HyperliquidCandle {
  t: number; // timestamp in ms
  T: number; // close timestamp in ms
  s: string; // symbol (e.g., "BTC-USD")
  i: string; // interval (e.g., "1m", "1h", "1d")
  o: string; // open price
  c: string; // close price
  h: string; // high price
  l: string; // low price
  v: string; // volume
  n: number; // number of trades (may be 0 if not provided)
}

export interface HyperliquidFundingRate {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
}

// Database types (matching Supabase schema)
export interface HyperliquidPositionDB {
  id: string;
  user_id: string;
  address: string;
  market: string;
  side: HyperliquidPositionSide;
  size: number;
  entry_price: number;
  leverage: number;
  unrealized_pnl: number;
  realized_pnl: number;
  liquidation_price: number | null;
  opened_at: string;
  closed_at: string | null;
  status: HyperliquidPositionStatus;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface HyperliquidOrderDB {
  id: string;
  user_id: string;
  address: string;
  order_id: number | null;
  client_order_id: string;
  market: string;
  side: HyperliquidOrderSide;
  order_type: HyperliquidOrderType;
  size: number;
  price: number | null;
  leverage: number;
  status: HyperliquidOrderStatus;
  filled_size: number;
  average_fill_price: number | null;
  reduce_only: boolean;
  post_only: boolean;
  time_in_force: string;
  tx_hash: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  filled_at: string | null;
}

export interface HyperliquidTradeDB {
  id: string;
  user_id: string;
  address: string;
  order_id: number | null;
  trade_id: number | null;
  market: string;
  side: HyperliquidOrderSide;
  size: number;
  price: number;
  fee: number;
  fee_asset: string;
  is_maker: boolean;
  timestamp: string;
  created_at: string;
}

export interface HyperliquidAccountSnapshot {
  id: string;
  user_id: string;
  address: string;
  account_value: number;
  equity: number;
  free_collateral: number;
  margin_usage: number;
  total_position_value: number;
  withdrawable: number;
  unrealized_pnl: number;
  timestamp: string;
}

// Bridge types
export interface BridgeTransaction {
  id: string;
  user_id: string;
  source_chain: string;
  destination_chain: string;
  source_tx_hash: string | null;
  destination_tx_hash: string | null;
  bridge_provider: string;
  amount: number;
  token: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimated_completion: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface HyperliquidWallet {
  id: string;
  user_id: string;
  address: string;
  encrypted_private_key: string;
  encryption_method: string;
  created_at: string;
  updated_at: string;
}
