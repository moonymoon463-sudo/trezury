/**
 * Trading chain configuration
 */

export const TRADING_CHAINS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth.llamarpc.com'],
    blockExplorerUrls: ['https://etherscan.io'],
    defaultLeverage: 10,
    maxLeverage: 50,
    isV3: true
  },
  base: {
    chainId: 8453,
    name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
    defaultLeverage: 10,
    maxLeverage: 50,
    isV3: true
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
    defaultLeverage: 10,
    maxLeverage: 50,
    isV3: true
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
    defaultLeverage: 10,
    maxLeverage: 25, // V2 has lower limits
    isV3: false
  }
} as const;

export type ChainKey = keyof typeof TRADING_CHAINS;
export type ChainConfig = typeof TRADING_CHAINS[ChainKey];

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return Object.values(TRADING_CHAINS).find(chain => chain.chainId === chainId);
}

export function isSupportedChain(chainId: number): boolean {
  return Object.values(TRADING_CHAINS).some(chain => chain.chainId === chainId);
}
