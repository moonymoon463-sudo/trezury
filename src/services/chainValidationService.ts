import { Chain, DeploymentChain } from '@/types/lending';

export interface ChainValidationService {
  validateChain(chain: string): chain is Chain;
  getSupportedChains(): Chain[];
  getChainDisplayName(chain: Chain): string;
  validateFeeCollectionRequest(chain: string, asset: string, amount: number): void;
}

class ChainValidationServiceImpl implements ChainValidationService {
  private readonly SUPPORTED_CHAINS: Chain[] = ['ethereum', 'base', 'solana', 'tron'];
  
  private readonly CHAIN_DISPLAY_NAMES: Record<Chain, string> = {
    ethereum: 'Ethereum',
    base: 'Base',
    solana: 'Solana',
    tron: 'Tron'
  };

  private readonly SUPPORTED_ASSETS: Record<Chain, string[]> = {
    ethereum: ['USDC', 'USDT', 'DAI', 'XAUT'],
    base: ['USDC'],
    solana: ['USDC', 'USDT'],
    tron: ['USDT', 'USDC']
  };

  validateChain(chain: string): chain is Chain {
    return this.SUPPORTED_CHAINS.includes(chain as Chain);
  }

  getSupportedChains(): Chain[] {
    return [...this.SUPPORTED_CHAINS];
  }

  getChainDisplayName(chain: Chain): string {
    return this.CHAIN_DISPLAY_NAMES[chain] || chain;
  }

  validateFeeCollectionRequest(chain: string, asset: string, amount: number): void {
    // Validate chain
    if (!this.validateChain(chain)) {
      throw new Error(`Unsupported chain: ${chain}. Supported chains: ${this.SUPPORTED_CHAINS.join(', ')}`);
    }

    // Validate asset for chain
    const supportedAssets = this.SUPPORTED_ASSETS[chain as Chain];
    if (!supportedAssets.includes(asset)) {
      throw new Error(`Asset ${asset} not supported on ${chain}. Supported assets: ${supportedAssets.join(', ')}`);
    }

    // Validate amount
    if (amount <= 0) {
      throw new Error('Fee amount must be greater than 0');
    }

    if (amount > 1000000) { // $1M limit for safety
      throw new Error('Fee amount exceeds maximum limit');
    }
  }

  getChainConfiguration(chain: Chain) {
    return {
      name: chain,
      displayName: this.getChainDisplayName(chain),
      supportedAssets: this.SUPPORTED_ASSETS[chain],
      isTestnet: false // Add testnet support if needed
    };
  }

  getAllChainConfigurations() {
    return this.SUPPORTED_CHAINS.map(chain => this.getChainConfiguration(chain));
  }
}

export const chainValidationService = new ChainValidationServiceImpl();