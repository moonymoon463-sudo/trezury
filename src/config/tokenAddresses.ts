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
  ETH: {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH representation for 0x API
    decimals: 18,
    symbol: 'ETH',
    chain: 'ethereum',
    chainId: 1
  },
  WETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Wrapped ETH
    decimals: 18,
    symbol: 'WETH',
    chain: 'ethereum',
    chainId: 1
  },
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    symbol: 'USDC',
    chain: 'ethereum',
    chainId: 1
  },
  XAUT: {
    address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', // Tether Gold on Ethereum (will migrate to Arbitrum)
    decimals: 6,
    symbol: 'XAUT',
    chain: 'arbitrum', // XAUT available on Arbitrum
    chainId: 42161
  },
  TRZRY: {
    address: '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B',
    decimals: 18,
    symbol: 'TRZRY',
    chain: 'ethereum', // TRZRY on Ethereum mainnet
    chainId: 1
  },
  BTC: {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    decimals: 8,
    symbol: 'BTC',
    chain: 'ethereum',
    chainId: 1
  }
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
