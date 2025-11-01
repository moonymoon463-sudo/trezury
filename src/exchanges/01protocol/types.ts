/**
 * 01 Protocol specific types and interfaces
 */

import { PublicKey, Keypair } from '@solana/web3.js';

export interface ZoConfig {
  cluster: 'mainnet-beta' | 'devnet';
  rpcUrl: string;
  programId: string;
}

export interface ZoMarket {
  symbol: string;
  address: PublicKey;
  baseDecimals: number;
  quoteDecimals: number;
  baseLotSize: number;
  quoteLotSize: number;
  baseMint: PublicKey;
  quoteMint: PublicKey;
}

export interface ZoPosition {
  market: string;
  side: 'long' | 'short';
  size: number;
  coins: number;
  entryPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  fundingPnl: number;
}

export interface ZoOrder {
  orderId: string;
  clientId: number;
  market: string;
  side: 'bid' | 'ask';
  price: number;
  size: number;
  filled: number;
  orderType: 'limit' | 'postOnly' | 'ioc' | 'fok';
  timestamp: number;
}

export interface ZoBalance {
  symbol: string;
  amount: number;
  value: number;
}

export interface ZoFundingRate {
  market: string;
  rate: number;
  timestamp: number;
  nextFundingTime: number;
}

export interface ZoTradeParams {
  market: string;
  isLong: boolean;
  size: number;
  price?: number;
  orderType: 'market' | 'limit' | 'postOnly' | 'ioc';
  leverage?: number;
  reduceOnly?: boolean;
}

export interface ZoApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}
