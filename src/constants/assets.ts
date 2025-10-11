/**
 * Asset configuration and display mappings
 * Use blockchain token symbols internally, display names in UI
 */

export const ASSETS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    displayName: 'Ethereum',
    decimals: 18,
    native: true,
    chain: 'ethereum' as const,
    chainId: 1,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    displayName: 'USD Coin',
    decimals: 6,
    chain: 'ethereum' as const,
    chainId: 1,
  },
  XAUT: {
    symbol: 'XAUT',
    name: 'Tether Gold',
    displayName: 'Gold',
    unit: 'oz',
    gramsPerOz: 31.1035,
    decimals: 6,
    chain: 'ethereum' as const, // XAUT on Ethereum mainnet
    chainId: 1,
  },
  TRZRY: {
    symbol: 'TRZRY',
    name: 'Trzry Reserve',
    displayName: 'Trzry',
    decimals: 6,
    chain: 'ethereum' as const, // TRZRY on Ethereum
    chainId: 1,
  },
  BTC: {
    symbol: 'BTC',
    name: 'Wrapped Bitcoin',
    displayName: 'Bitcoin',
    decimals: 8,
    chain: 'ethereum' as const,
    chainId: 1,
  },
} as const;

export type AssetSymbol = keyof typeof ASSETS;

/**
 * Get display name for an asset symbol
 */
export function getAssetDisplayName(symbol: AssetSymbol): string {
  return ASSETS[symbol].displayName;
}

/**
 * Get full name for an asset symbol
 */
export function getAssetName(symbol: AssetSymbol): string {
  return ASSETS[symbol].name;
}
