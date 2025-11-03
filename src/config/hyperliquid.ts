export const HYPERLIQUID_CONFIG = {
  mainnet: {
    restEndpoint: 'https://api.hyperliquid.xyz',
    wsEndpoint: 'wss://api.hyperliquid.xyz/ws',
    chainId: 421614, // HyperEVM chain ID
    explorerUrl: 'https://app.hyperliquid.xyz',
  },
  testnet: {
    restEndpoint: 'https://api.hyperliquid-testnet.xyz',
    wsEndpoint: 'wss://api.hyperliquid-testnet.xyz/ws',
    chainId: 998,
    explorerUrl: 'https://testnet.hyperliquid.xyz',
  }
};

export const HYPERLIQUID_NETWORK = import.meta.env.VITE_HYPERLIQUID_NETWORK || 'mainnet';

export const HYPERLIQUID_API = HYPERLIQUID_CONFIG[HYPERLIQUID_NETWORK as keyof typeof HYPERLIQUID_CONFIG];

export const SUPPORTED_BRIDGE_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: '⟠', chainId: 1 },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', icon: '🔵', chainId: 42161 },
  { id: 'bsc', name: 'BNB Chain', symbol: 'BNB', icon: '🔶', chainId: 56 },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', icon: '🟣', chainId: 137 },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH', icon: '🔴', chainId: 10 },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', icon: '🔺', chainId: 43114 },
  { id: 'base', name: 'Base', symbol: 'ETH', icon: '🔷', chainId: 8453 },
];

export const BRIDGE_PROVIDERS = [
  {
    id: 'across',
    name: 'Across Protocol',
    description: 'Fast cross-chain bridge',
    speed: '30s - 2min',
    fees: '0.1% - 0.5%',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'bsc'],
    recommended: true
  },
  {
    id: 'stargate',
    name: 'Stargate',
    description: 'LayerZero powered bridge',
    speed: '1 - 5min',
    fees: '0.1% - 0.3%',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche'],
    recommended: false
  },
  {
    id: 'native',
    name: 'Arbitrum Bridge',
    description: 'Official Arbitrum bridge',
    speed: '5 - 10min',
    fees: 'Gas only',
    supportedChains: ['ethereum', 'arbitrum'],
    recommended: false
  }
];

export const HYPERLIQUID_DEPOSIT_ADDRESS = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7'; // Hyperliquid mainnet deposit contract

export const SUPPORTED_DEPOSIT_ASSETS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    }
  }
];

export const DEFAULT_LEVERAGE = 3;
export const MAX_LEVERAGE = 50;
export const MIN_ORDER_SIZE_USD = 10;
export const DEFAULT_SLIPPAGE = 0.5; // 0.5%
