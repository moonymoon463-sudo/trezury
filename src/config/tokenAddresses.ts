// Centralized token address configuration for Ethereum mainnet
// This ensures consistency across all services and makes it easy to add new tokens

export type Chain = 'ethereum' | 'arbitrum';

export interface TokenConfig {
  address: string;
  decimals: number;
  symbol: string;
  chain: Chain;
  chainId: number;
}

export const TOKEN_ADDRESSES: Record<string, TokenConfig> = {
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    symbol: 'USDC',
    chain: 'ethereum',
    chainId: 1
  },
  XAUT: {
    address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', // Tether Gold on Ethereum
    decimals: 6,
    symbol: 'XAUT',
    chain: 'ethereum',
    chainId: 1
  },
  TRZRY: {
    address: '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B',
    decimals: 18,
    symbol: 'TRZRY',
    chain: 'ethereum',
    chainId: 1
  },
  WETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    symbol: 'WETH',
    chain: 'ethereum',
    chainId: 1
  },
  // Arbitrum tokens
  'USDC_ARB': {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Native USDC on Arbitrum
    decimals: 6,
    symbol: 'USDC',
    chain: 'arbitrum',
    chainId: 42161
  },
  'WETH_ARB': {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    symbol: 'WETH',
    chain: 'arbitrum',
    chainId: 42161
  }
  // Note: XAUT is not supported on Arbitrum due to lack of liquidity
  // Use Ethereum mainnet for XAUT swaps
};

// Legacy compatibility: Map symbols to addresses (for services using old format)
export const TOKEN_ADDRESSES_LEGACY: Record<string, string> = Object.entries(TOKEN_ADDRESSES)
  .reduce((acc, [symbol, config]) => {
    acc[symbol] = config.address;
    return acc;
  }, {} as Record<string, string>);

// Get token decimals by symbol
export const TOKEN_DECIMALS: Record<string, number> = Object.entries(TOKEN_ADDRESSES)
  .reduce((acc, [symbol, config]) => {
    acc[symbol] = config.decimals;
    return acc;
  }, {} as Record<string, number>);

// Helper function to get token config by symbol
export function getTokenConfig(symbol: string): TokenConfig {
  const config = TOKEN_ADDRESSES[symbol];
  if (!config) {
    throw new Error(`Unsupported token: ${symbol}`);
  }
  return config;
}

// Helper function to get token address by symbol
export function getTokenAddress(symbol: string): string {
  return getTokenConfig(symbol).address;
}

// Helper function to get token decimals by symbol
export function getTokenDecimals(symbol: string): number {
  return getTokenConfig(symbol).decimals;
}

// Helper function to get token chain by symbol
export function getTokenChain(symbol: string): Chain {
  return getTokenConfig(symbol).chain;
}

// Helper function to get token chainId by symbol
export function getTokenChainId(symbol: string): number {
  return getTokenConfig(symbol).chainId;
}
