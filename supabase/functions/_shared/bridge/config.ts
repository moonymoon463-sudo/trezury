/**
 * Bridge configuration and constants
 */

// Transaction limits per chain (in USDC)
export const BRIDGE_LIMITS: Record<string, { min: number; max: number }> = {
  ethereum: { min: 10, max: 100000 },
  arbitrum: { min: 10, max: 100000 },
  optimism: { min: 10, max: 100000 },
  polygon: { min: 10, max: 50000 },
  base: { min: 10, max: 50000 },
  bsc: { min: 10, max: 50000 },
  avalanche: { min: 10, max: 50000 },
};

// Transaction timeout (30 minutes)
export const TRANSACTION_TIMEOUT_MS = 30 * 60 * 1000;

// Approval transaction timeout (5 minutes)
export const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

// Across Protocol configuration
export const ACROSS_CONFIG = {
  feeRate: 0.003, // 0.3%
  supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc'],
  spokePoolAddresses: {
    ethereum: '0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5',
    arbitrum: '0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A',
    optimism: '0x6f26Bf09B1C792e3228e5467807a900A503c0281',
    polygon: '0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096',
    base: '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64',
    bsc: '0x4e8E101924eDE233C13e2D8622DC8aED2872d505',
  },
  chainIds: {
    ethereum: 1,
    arbitrum: 42161,
    optimism: 10,
    polygon: 137,
    base: 8453,
    bsc: 56,
  },
  timeEstimates: {
    ethereum: '1-3min',
    arbitrum: '30s-2min',
    default: '1-3min',
  },
  gasEstimates: {
    ethereum: '$5-30',
    arbitrum: '$0.10-0.50',
    optimism: '$0.10-0.50',
    polygon: '$0.50-2',
    base: '$0.05-0.30',
    bsc: '$0.30-1',
  },
} as const;

// Wormhole configuration
export const WORMHOLE_CONFIG = {
  feeRate: 0.001, // 0.1%
  nativeFee: '0.001', // ETH for Wormhole message fee
  supportedChains: ['ethereum', 'bsc', 'polygon', 'avalanche', 'arbitrum'],
  tokenBridgeAddresses: {
    ethereum: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
    bsc: '0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7',
    polygon: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
    avalanche: '0x0e082F06FF657D94310cB8cE8B0D9a04541d8052',
    arbitrum: '0x0b2402144Bb366A632D14B83F244D2e0e21bD39c',
  },
  chainIds: {
    ethereum: 2,
    bsc: 4,
    polygon: 5,
    avalanche: 6,
    arbitrum: 23,
    solana: 1,
  },
  timeEstimates: {
    avalanche: '5-15min',
    ethereum: '10-20min',
    bsc: '5-15min',
    polygon: '5-15min',
    default: '5-15min',
  },
  gasEstimates: {
    ethereum: '$8-40',
    arbitrum: '$0.15-0.60',
    optimism: '$0.15-0.60',
    polygon: '$1-3',
    bsc: '$0.50-1.50',
    avalanche: '$1-4',
  },
} as const;

// USDC token addresses
export const USDC_ADDRESSES: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
};

// Standard ERC20 ABI
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];
