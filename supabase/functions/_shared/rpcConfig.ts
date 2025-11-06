/**
 * RPC URL configuration for different chains
 */

export function getRpcUrl(chain: string): string {
  const infuraKey = Deno.env.get('INFURA_API_KEY');
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');

  // Validate API keys for chains that need them
  const requiresInfura = ['ethereum'];
  const requiresAlchemy = ['arbitrum', 'optimism', 'polygon', 'base'];
  
  if (requiresInfura.includes(chain) && !infuraKey) {
    throw new Error('INFURA_API_KEY environment variable is required for Ethereum');
  }
  
  if (requiresAlchemy.includes(chain) && !alchemyKey) {
    throw new Error('ALCHEMY_API_KEY environment variable is required for this chain');
  }

  switch (chain) {
    case 'ethereum':
      return `https://mainnet.infura.io/v3/${infuraKey}`;
    case 'arbitrum':
      return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 'optimism':
      return `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 'polygon':
      return `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 'base':
      return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 'bsc':
      return 'https://bsc-dataseed.bnbchain.org';
    case 'avalanche':
      return 'https://api.avax.network/ext/bc/C/rpc';
    default:
      throw new Error(`No RPC URL configured for chain: ${chain}`);
  }
}
