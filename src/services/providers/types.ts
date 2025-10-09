export interface OnchainAddress {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  asset: string;
  created_at: string;
}

export interface Deposit {
  id: string;
  user_id: string;
  address: string;
  amount: number;
  asset: string;
  chain: string;
  tx_hash?: string;
  block_number?: number;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
  confirmed_at?: string;
  metadata: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: 'card' | 'bank_account';
  provider: string;
  external_id: string;
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DepositStatus = 'pending' | 'confirmed' | 'failed';
export type PaymentMethodType = 'card' | 'bank_account';
export type SupportedChain = 'base' | 'ethereum';
export type SupportedAsset = 'ETH' | 'USDC' | 'XAUT' | 'TRZRY' | 'BTC';

export interface NetworkConfig {
  chain: SupportedChain;
  nativeAssets: SupportedAsset[];
  rpcUrl?: string;
  blockExplorer?: string;
}

export const NETWORK_CONFIGS: Record<SupportedChain, NetworkConfig> = {
  base: {
    chain: 'base',
    nativeAssets: [],
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org'
  },
  ethereum: {
    chain: 'ethereum', 
    nativeAssets: ['ETH', 'USDC', 'XAUT', 'TRZRY', 'BTC'], // ETH is native, XAUT is Tether Gold (1 token = 1 oz), TRZRY is treasury token, BTC is WBTC
    rpcUrl: 'https://mainnet.infura.io',
    blockExplorer: 'https://etherscan.io'
  }
};