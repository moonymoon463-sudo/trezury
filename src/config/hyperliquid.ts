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

export const BRIDGE_OPTIONS = [
  {
    name: 'Across Protocol',
    url: 'https://across.to/bridge?from=1&to=42161&token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    description: 'Fast cross-chain bridge',
    chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Base', 'Polygon', 'BSC', 'Linea', 'Scroll'],
    speed: '30 seconds - 2 minutes',
    fees: 'Variable (0.1% - 0.5%)',
    recommended: true
  },
  {
    name: 'Arbitrum Bridge',
    url: 'https://bridge.arbitrum.io/',
    description: 'Official Arbitrum bridge',
    chains: ['Ethereum', 'Arbitrum'],
    speed: '5-10 minutes',
    fees: 'Gas only',
    recommended: false
  },
  {
    name: 'Stargate',
    url: 'https://stargate.finance/bridge',
    description: 'LayerZero powered bridge',
    chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'BSC', 'Avalanche'],
    speed: '1-5 minutes',
    fees: 'Variable (0.1% - 0.3%)',
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
