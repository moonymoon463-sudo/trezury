/**
 * Synthetix Perps V3 Type Definitions
 */

export interface SnxMarket {
  marketId: bigint;
  marketKey: string;
  symbol: string;
  name: string;
  price: number;
  indexPrice: number;
  fundingRate: number; // Hourly funding rate
  nextFundingTime: number;
  openInterest: number;
  skew: number;
  maxLeverage: number;
  makerFee: number;
  takerFee: number;
  maxMarketValue: number;
  lastUpdated: number;
}

export interface SnxMarketDetails extends SnxMarket {
  settlementStrategy: {
    settlementDelay: number;
    settlementWindowDuration: number;
    priceDeviationTolerance: number;
  };
  liquidation: {
    initialMarginRatio: number;
    maintenanceMarginRatio: number;
    liquidationRewardRatio: number;
  };
}

export interface SnxAccount {
  accountId: bigint;
  owner: string;
  collateral: number;
  availableMargin: number;
  requiredInitialMargin: number;
  requiredMaintenanceMargin: number;
  totalPnl: number;
  openPositions: number;
}

export interface SnxPosition {
  accountId: bigint;
  marketId: bigint;
  marketKey: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  notionalValue: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  unrealizedPnl: number;
  realizedPnl: number;
  liquidationPrice: number;
  marginRatio: number;
  fundingAccrued: number;
  openedAt: number;
}

export type SnxOrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';
export type SnxOrderSide = 'BUY' | 'SELL';
export type SnxOrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'FAILED';

export interface SnxOrder {
  id: string;
  accountId: bigint;
  marketId: bigint;
  marketKey: string;
  type: SnxOrderType;
  side: SnxOrderSide;
  size: number;
  leverage: number;
  price?: number;
  triggerPrice?: number;
  status: SnxOrderStatus;
  filledSize: number;
  filledPrice?: number;
  txHash?: string;
  createdAt: number;
  filledAt?: number;
}

export interface TradeParams {
  accountId: bigint;
  marketId: bigint;
  sizeDelta: number; // Positive for long, negative for short
  acceptablePrice: number; // Slippage protection
  trackingCode?: string;
  referrer?: string;
}

export interface MarginInfo {
  requiredMargin: number;
  availableMargin: number;
  sufficient: boolean;
  liquidationPrice: number;
  marginRatio: number;
}

export interface FundingRateInfo {
  currentFundingRate: number; // Hourly rate
  annualizedRate: number;
  nextFundingTime: number;
  fundingVelocity: number;
}

export interface SnxTradeRequest {
  marketKey: string;
  side: SnxOrderSide;
  type: SnxOrderType;
  size: number;
  leverage: number;
  price?: number;
  slippageBps?: number;
  reduceOnly?: boolean;
}

export interface SnxTradeResponse {
  success: boolean;
  order?: SnxOrder;
  txHash?: string;
  error?: string;
  errorCode?: string;
}

export interface LeverageValidation {
  valid: boolean;
  maxAllowed: number;
  reason?: string;
}

export interface PositionRisk {
  distanceToLiquidation: number; // Percentage
  marginRatio: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction?: string;
}

// Database types (snake_case for DB schema)
export interface SnxOrderDB {
  id: string;
  user_id: string;
  account_id: string;
  market_id: string;
  market_key: string;
  type: SnxOrderType;
  side: SnxOrderSide;
  size: number;
  leverage: number;
  price?: number;
  status: SnxOrderStatus;
  filled_size: number;
  filled_price?: number;
  tx_hash?: string;
  chain_id: number;
  wallet_source: 'internal' | 'external';
  created_at: string;
  updated_at: string;
  filled_at?: string;
  metadata?: Record<string, any>;
}

export interface SnxPositionDB {
  id: string;
  user_id: string;
  account_id: string;
  market_id: string;
  market_key: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entry_price: number;
  leverage: number;
  unrealized_pnl: number;
  realized_pnl: number;
  liquidation_price: number;
  funding_accrued: number;
  chain_id: number;
  opened_at: string;
  closed_at?: string;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
}
