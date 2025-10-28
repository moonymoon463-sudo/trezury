/**
 * Synthetix Perps V3 Contract Addresses
 * Source: https://docs.synthetix.io/developer-docs/smart-contracts/addresses-abis
 * Updated: 2025-01
 */

export const SNX_ADDRESSES = {
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: 'Ethereum',
    perpsMarketProxy: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce',
    accountProxy: '0x0E429603D3Cb1DFae4E6F52Add5fE82d96d77Dac',
    spotMarketProxy: '0x18141523403e2595D31b22604AcB8Fc06a4CaA61',
    coreProxy: '0xffffffaEff0B96Ea8e4f94b2253f31abdD875847',
    multicall: '0xcA11bde05977b3631167028862bE2a173976CA11',
    // Market IDs for major assets
    markets: {
      ETH: { 
        marketId: 100, 
        marketKey: '0x4554482d50455250000000000000000000000000000000000000000000000000',
        symbol: 'ETH',
        name: 'Ethereum'
      },
      BTC: { 
        marketId: 200, 
        marketKey: '0x4254432d50455250000000000000000000000000000000000000000000000000',
        symbol: 'BTC',
        name: 'Bitcoin'
      },
    }
  },

  // Optimism (if V3 available)
  10: {
    chainId: 10,
    name: 'Optimism',
    // V3 not yet on Optimism, using V2 addresses as fallback
    perpsMarketProxy: '0xf272382cB3BE898A8CdB1A23BE056fA2Fcf4513b', // V2 Market Manager
    accountProxy: '0x0000000000000000000000000000000000000000', // Not available
    spotMarketProxy: '0x0000000000000000000000000000000000000000',
    coreProxy: '0x0000000000000000000000000000000000000000',
    multicall: '0xcA11bde05977b3631167028862bE2a173976CA11',
    markets: {}
  },

  // Base (V3 Primary Network)
  8453: {
    chainId: 8453,
    name: 'Base',
    perpsMarketProxy: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce',
    accountProxy: '0x63f4Dd0434BEB5baeCD27F3778a909278d8cf5b8',
    spotMarketProxy: '0x18141523403e2595D31b22604AcB8Fc06a4CaA61',
    coreProxy: '0x32C222A9A159782aFD7529c87FA34b96CA72C696',
    multicall: '0xcA11bde05977b3631167028862bE2a173976CA11',
    markets: {
      ETH: { 
        marketId: 100, 
        marketKey: '0x4554482d50455250000000000000000000000000000000000000000000000000',
        symbol: 'ETH',
        name: 'Ethereum'
      },
      BTC: { 
        marketId: 200, 
        marketKey: '0x4254432d50455250000000000000000000000000000000000000000000000000',
        symbol: 'BTC',
        name: 'Bitcoin'
      },
      SOL: {
        marketId: 300,
        marketKey: '0x534f4c2d50455250000000000000000000000000000000000000000000000000',
        symbol: 'SOL',
        name: 'Solana'
      },
      ARB: {
        marketId: 400,
        marketKey: '0x4152422d50455250000000000000000000000000000000000000000000000000',
        symbol: 'ARB',
        name: 'Arbitrum'
      },
      OP: {
        marketId: 500,
        marketKey: '0x4f502d504552500000000000000000000000000000000000000000000000000',
        symbol: 'OP',
        name: 'Optimism'
      },
      WIF: {
        marketId: 600,
        marketKey: '0x5749462d50455250000000000000000000000000000000000000000000000000',
        symbol: 'WIF',
        name: 'dogwifhat'
      }
    }
  },

  // Arbitrum
  42161: {
    chainId: 42161,
    name: 'Arbitrum',
    perpsMarketProxy: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce',
    accountProxy: '0xcb68b813210aFa0373F076239Ad4803f8809e8cf',
    spotMarketProxy: '0x18141523403e2595D31b22604AcB8Fc06a4CaA61',
    coreProxy: '0x76490713314fCEC173f44e99346F54c6e92a8E42',
    multicall: '0xcA11bde05977b3631167028862bE2a173976CA11',
    markets: {
      ETH: { 
        marketId: 100, 
        marketKey: '0x4554482d50455250000000000000000000000000000000000000000000000000',
        symbol: 'ETH',
        name: 'Ethereum'
      },
      BTC: { 
        marketId: 200, 
        marketKey: '0x4254432d50455250000000000000000000000000000000000000000000000000',
        symbol: 'BTC',
        name: 'Bitcoin'
      },
    }
  }
} as const;

export const SUPPORTED_NETWORKS = [
  { chainId: 1, name: 'Ethereum', rpc: 'https://eth.llamarpc.com', isV3: true },
  { chainId: 8453, name: 'Base', rpc: 'https://mainnet.base.org', isV3: true },
  { chainId: 42161, name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', isV3: true },
  { chainId: 10, name: 'Optimism', rpc: 'https://mainnet.optimism.io', isV3: false } // V2 only
] as const;

export const DEFAULT_CHAIN_ID = 8453; // Base (lowest fees, best V3 support)

export type SupportedChainId = keyof typeof SNX_ADDRESSES;
export type MarketKey = keyof typeof SNX_ADDRESSES[8453]['markets'];

// Helper to get addresses for a chain
export function getSnxAddresses(chainId: number) {
  if (!(chainId in SNX_ADDRESSES)) {
    throw new Error(`Chain ${chainId} not supported for Synthetix Perps`);
  }
  return SNX_ADDRESSES[chainId as SupportedChainId];
}

// Helper to get market info
export function getMarketInfo(chainId: number, marketKey: string) {
  const addresses = getSnxAddresses(chainId);
  const market = Object.values(addresses.markets).find(m => m.symbol === marketKey);
  if (!market) {
    throw new Error(`Market ${marketKey} not found on chain ${chainId}`);
  }
  return market;
}
