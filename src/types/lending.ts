export type Chain = 'ethereum' | 'base' | 'solana' | 'tron';
export type Token = 'USDC' | 'USDT' | 'DAI';
export type LockStatus = 'active' | 'matured' | 'exited_early';

export interface LockTerm {
  days: number;
  label: string;
  apyMin: number;
  apyMax: number;
}

export interface Lock {
  id: string;
  user_id: string;
  chain: Chain;
  token: Token;
  amount_dec: number;
  apy_min: number;
  apy_max: number;
  apy_applied: number;
  start_ts: string;
  end_ts: string;
  status: LockStatus;
  accrued_interest_dec: number;
  autocompound: boolean;
  deposit_tx?: string;
  withdraw_tx?: string;
  created_at: string;
  updated_at: string;
}

export interface PoolStats {
  id: string;
  chain: Chain;
  token: Token;
  total_deposits_dec: number;
  total_borrowed_dec: number;
  utilization_fp: number;
  reserve_balance_dec: number;
  updated_ts: string;
}

export interface Payout {
  id: string;
  lock_id: string;
  principal_dec: number;
  interest_dec: number;
  chain: Chain;
  token: Token;
  ts: string;
  tx_hash?: string;
}

export interface ChainConfig {
  name: string;
  displayName: string;
  tokens: TokenConfig[];
  explorerUrl: string;
}

export interface TokenConfig {
  symbol: Token;
  address: string;
  decimals: number;
}

export const LOCK_TERMS: LockTerm[] = [
  { days: 30, label: '30 days', apyMin: 3, apyMax: 5 },
  { days: 90, label: '90 days', apyMin: 6, apyMax: 8 },
  { days: 180, label: '6 months', apyMin: 8, apyMax: 10 },
  { days: 365, label: '12 months', apyMin: 10, apyMax: 16 },
  { days: 540, label: '18 months', apyMin: 12, apyMax: 19 },
  { days: 730, label: '24 months', apyMin: 14, apyMax: 22 }
];

export const CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  ethereum: {
    name: 'ethereum',
    displayName: 'Ethereum',
    tokens: [
      { symbol: 'USDC', address: '0xA0b86a33E6441E93C736Ef19a0d0CeBed7A5e8c6', decimals: 6 },
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 }
    ],
    explorerUrl: 'https://etherscan.io'
  },
  base: {
    name: 'base',
    displayName: 'Base',
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 }
    ],
    explorerUrl: 'https://basescan.org'
  },
  solana: {
    name: 'solana',
    displayName: 'Solana',
    tokens: [
      { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
      { symbol: 'USDT', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 }
    ],
    explorerUrl: 'https://explorer.solana.com'
  },
  tron: {
    name: 'tron',
    displayName: 'Tron',
    tokens: [
      { symbol: 'USDT', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 },
      { symbol: 'USDC', address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', decimals: 6 }
    ],
    explorerUrl: 'https://tronscan.org'
  }
};