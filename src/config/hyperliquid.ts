export const HYPERLIQUID_CONFIG = {
  mainnet: {
    restEndpoint: 'https://api.hyperliquid.xyz',
    wsEndpoint: 'wss://api.hyperliquid.xyz/ws',
    chainId: 421614, // HyperEVM Mainnet chain ID (0x66eee in hex)
    signatureChainId: '0x66eee', // Used for EIP-712 signatures
    explorerUrl: 'https://app.hyperliquid.xyz',
    l1Network: 'hyperliquid',
    depositContract: '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7'
  },
  testnet: {
    restEndpoint: 'https://api.hyperliquid-testnet.xyz',
    wsEndpoint: 'wss://api.hyperliquid-testnet.xyz/ws',
    chainId: 998, // Testnet chain ID
    signatureChainId: '0x3e6', // Used for EIP-712 signatures (998 in hex)
    explorerUrl: 'https://testnet.hyperliquid.xyz',
    l1Network: 'hyperliquid-testnet',
    depositContract: '0x0000000000000000000000000000000000000000' // Testnet deposit contract
  }
};

export const HYPERLIQUID_NETWORK = (import.meta.env.VITE_HYPERLIQUID_NETWORK || 'mainnet') as 'mainnet' | 'testnet';

export const HYPERLIQUID_API = HYPERLIQUID_CONFIG[HYPERLIQUID_NETWORK as keyof typeof HYPERLIQUID_CONFIG];

export const HYPERLIQUID_L1_INFO = {
  id: 'hyperliquid',
  name: 'Hyperliquid L1',
  symbol: 'USDC',
  icon: '🔵',
  chainId: 421614,
  isL1: true,
  description: 'Hyperliquid native blockchain'
};

export const SUPPORTED_BRIDGE_CHAINS = [
  { 
    id: 'base', 
    name: 'Base', 
    symbol: 'ETH', 
    icon: '🔷', 
    chainId: 8453,
    iconUrl: 'https://assets.coingecko.com/asset_platforms/images/131/small/base.png'
  },
  { 
    id: 'arbitrum', 
    name: 'Arbitrum', 
    symbol: 'ETH', 
    icon: '🔵', 
    chainId: 42161,
    iconUrl: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg'
  },
  { 
    id: 'optimism', 
    name: 'Optimism', 
    symbol: 'ETH', 
    icon: '🔴', 
    chainId: 10,
    iconUrl: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png'
  },
  { 
    id: 'polygon', 
    name: 'Polygon', 
    symbol: 'MATIC', 
    icon: '🟣', 
    chainId: 137,
    iconUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png'
  },
  { 
    id: 'bsc', 
    name: 'BNB Chain', 
    symbol: 'BNB', 
    icon: '🟡', 
    chainId: 56,
    iconUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'
  },
  { 
    id: 'avalanche', 
    name: 'Avalanche', 
    symbol: 'AVAX', 
    icon: '🔺', 
    chainId: 43114,
    iconUrl: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png'
  },
  { 
    id: 'solana', 
    name: 'Solana', 
    symbol: 'SOL', 
    icon: '◎', 
    chainId: null,
    iconUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png'
  },
  { 
    id: 'ethereum', 
    name: 'Ethereum', 
    symbol: 'ETH', 
    icon: '⟠', 
    chainId: 1,
    iconUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  }
];

export const BRIDGE_PROVIDERS = [
  {
    id: 'across',
    name: 'Across Protocol',
    description: 'Fast cross-chain bridge',
    speed: '30s - 2min',
    fees: '0.3% + gas',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'bsc', 'solana'],
    recommended: true
  },
  {
    id: 'stargate',
    name: 'Stargate',
    description: 'LayerZero powered bridge',
    speed: '1 - 5min',
    fees: '0.2% + gas',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche', 'solana'],
    recommended: false
  },
  {
    id: 'native',
    name: 'Arbitrum Bridge',
    description: 'Official Arbitrum bridge',
    speed: '5 - 10min',
    fees: '0.1% + gas',
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
