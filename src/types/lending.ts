export type Chain = 'ethereum' | 'base' | 'solana' | 'tron';
export type Token = 'USDC' | 'USDT' | 'DAI' | 'XAUT' | 'AURU';
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
  { days: 30, label: '30 days', apyMin: 1, apyMax: 3 },
  { days: 90, label: '90 days', apyMin: 1, apyMax: 3 },
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
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
      { symbol: 'XAUT', address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', decimals: 6 },
      { symbol: 'AURU', address: '0x0000000000000000000000000000000000000000', decimals: 18 } // Placeholder - update with actual contract
    ],
    explorerUrl: 'https://etherscan.io'
  },
  base: {
    name: 'base',
    displayName: 'Base',
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6 },
      { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
      { symbol: 'XAUT', address: '0x0000000000000000000000000000000000000000', decimals: 6 }, // Placeholder - XAUT not on Base yet
      { symbol: 'AURU', address: '0x0000000000000000000000000000000000000000', decimals: 18 } // Placeholder - update with actual contract
    ],
    explorerUrl: 'https://basescan.org'
  },
  solana: {
    name: 'solana',
    displayName: 'Solana',
    tokens: [
      { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
      { symbol: 'USDT', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
      { symbol: 'DAI', address: '0x0000000000000000000000000000000000000000', decimals: 18 }, // Placeholder - DAI not common on Solana
      { symbol: 'XAUT', address: '0x0000000000000000000000000000000000000000', decimals: 6 }, // Placeholder - XAUT not on Solana
      { symbol: 'AURU', address: '0x0000000000000000000000000000000000000000', decimals: 18 } // Placeholder - update with actual contract
    ],
    explorerUrl: 'https://explorer.solana.com'
  },
  tron: {
    name: 'tron',
    displayName: 'Tron',
    tokens: [
      { symbol: 'USDT', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 },
      { symbol: 'USDC', address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', decimals: 6 },
      { symbol: 'DAI', address: '0x0000000000000000000000000000000000000000', decimals: 18 }, // Placeholder - DAI not common on Tron
      { symbol: 'XAUT', address: '0x0000000000000000000000000000000000000000', decimals: 6 }, // Placeholder - XAUT not on Tron
      { symbol: 'AURU', address: '0x0000000000000000000000000000000000000000', decimals: 18 } // Placeholder - update with actual contract
    ],
    explorerUrl: 'https://tronscan.org'
  }
};

// Deposit wallet addresses for receiving lending funds
export const LENDING_DEPOSIT_WALLETS: Record<Chain, Record<Token, string>> = {
  ethereum: {
    USDC: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06', // Platform USDC deposit wallet
    USDT: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06', // Platform USDT deposit wallet  
    DAI: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06',   // Platform DAI deposit wallet
    XAUT: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06',  // Platform XAUT deposit wallet
    AURU: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06'   // Platform AURU governance token wallet
  },
  base: {
    USDC: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06', // Platform Base USDC wallet
    USDT: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06', // Platform Base USDT wallet
    DAI: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06',  // Platform Base DAI wallet
    XAUT: '',  // XAUT not available on Base yet
    AURU: '0x5CCcCD2973Bf4198a0E1487FeaFe05B5119eFC06'  // Platform Base AURU wallet
  },
  solana: {
    USDC: '4zVpkkUx5f3c84mGCmbxHxbZhbUQ9yixm2NsAU4zrcj7', // Platform Solana USDC wallet
    USDT: '4zVpkkUx5f3c84mGCmbxHxbZhbUQ9yixm2NsAU4zrcj7', // Platform Solana USDT wallet
    DAI: '',   // DAI not common on Solana
    XAUT: '',  // XAUT not available on Solana
    AURU: '4zVpkkUx5f3c84mGCmbxHxbZhbUQ9yixm2NsAU4zrcj7'  // Platform Solana AURU wallet
  },
  tron: {
    USDT: 'TFLY2RJXohwZp1ppxiUdySstHUHZ2wc1Zm', // Platform Tron USDT wallet
    USDC: 'TFLY2RJXohwZp1ppxiUdySstHUHZ2wc1Zm', // Platform Tron USDC wallet
    DAI: '',   // DAI not common on Tron
    XAUT: '',  // XAUT not available on Tron
    AURU: 'TFLY2RJXohwZp1ppxiUdySstHUHZ2wc1Zm'  // Platform Tron AURU wallet
  }
};

// Platform fee collection wallets for each chain
export const PLATFORM_FEE_WALLETS: Record<Chain, string> = {
  ethereum: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835', // Ethereum fee collection wallet
  base: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',     // Base fee collection wallet  
  solana: 'BzSNDYfdEf8Q2wpr3rvrqQyreAWqB25AnmQA6XohUNom',   // Solana fee collection wallet
  tron: 'TJChKfcNH9YamKfhvhiHhfDzMtBwNq9wnQ'              // Tron fee collection wallet
};