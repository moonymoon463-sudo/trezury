export type DydxOrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';
export type DydxOrderSide = 'BUY' | 'SELL';
export type DydxOrderStatus = 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
export type DydxTimeInForce = 'GTT' | 'FOK' | 'IOC';

export interface DydxOrder {
  id: string;
  clientId: string;
  userId: string;
  market: string;
  side: DydxOrderSide;
  type: DydxOrderType;
  size: number;
  price?: number;
  leverage: number;
  status: DydxOrderStatus;
  filledSize: number;
  averageFillPrice?: number;
  timeInForce?: DydxTimeInForce;
  reduceOnly?: boolean;
  postOnly?: boolean;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
  filledAt?: string;
  metadata?: Record<string, any>;
}

export interface DydxAccountInfo {
  address: string;
  equity: number;
  freeCollateral: number;
  marginUsage: number;
  totalPositionValue: number;
  openPositions: number;
  pendingOrders: number;
  unrealizedPnl: number;
  realizedPnl: number;
  lastUpdated: number;
}

export interface LeverageConfig {
  market: string;
  currentLeverage: number;
  maxLeverage: number;
  initialMarginFraction: number;
  maintenanceMarginFraction: number;
}

export interface OrderRequest {
  market: string;
  side: DydxOrderSide;
  type: DydxOrderType;
  size: number;
  price?: number;
  leverage: number;
  reduceOnly?: boolean;
  postOnly?: boolean;
  timeInForce?: DydxTimeInForce;
  clientId?: string;
}

export interface MarginRequirement {
  requiredMargin: number;
  availableMargin: number;
  sufficient: boolean;
  liquidationPrice: number;
}

export interface PositionRisk {
  distanceToLiquidation: number;
  marginRatio: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction?: string;
}

export interface OrderResponse {
  success: boolean;
  order?: DydxOrder;
  txHash?: string;
  error?: string;
  errorCode?: string;
}

export interface LeverageValidation {
  valid: boolean;
  maxAllowed: number;
  reason?: string;
}

export interface PositionSize {
  maxSize: number;
  recommendedSize: number;
  basedOnLeverage: number;
}
