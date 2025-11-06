/**
 * RPC Failover Service
 * Provides automatic failover between multiple RPC providers
 */

import { ethers } from 'ethers';
import { logger } from '@/utils/logger';

export interface RPCProvider {
  name: string;
  url: string;
  priority: number;
  timeout?: number;
}

export class RPCFailoverService {
  private providers: RPCProvider[] = [];
  private currentProvider: ethers.JsonRpcProvider | null = null;
  private currentIndex = 0;
  private failureCount = new Map<string, number>();
  private maxFailures = 3;

  constructor(providers: RPCProvider[]) {
    this.providers = providers.sort((a, b) => a.priority - b.priority);
    this.initializeProvider();
  }

  private initializeProvider() {
    if (this.providers.length === 0) {
      logger.critical('No RPC providers configured');
      throw new Error('No RPC providers configured');
    }

    const provider = this.providers[this.currentIndex];
    this.currentProvider = new ethers.JsonRpcProvider(provider.url);
    
    logger.info('Initialized RPC provider', {
      provider: provider.name,
      priority: provider.priority
    });
  }

  async getProvider(): Promise<ethers.JsonRpcProvider> {
    if (!this.currentProvider) {
      this.initializeProvider();
    }
    return this.currentProvider!;
  }

  private async failover() {
    const currentProvider = this.providers[this.currentIndex];
    const failures = (this.failureCount.get(currentProvider.name) || 0) + 1;
    this.failureCount.set(currentProvider.name, failures);

    logger.warn('RPC provider failure', {
      provider: currentProvider.name,
      failures,
      maxFailures: this.maxFailures
    });

    // Try next provider
    this.currentIndex = (this.currentIndex + 1) % this.providers.length;
    
    // If we've cycled through all providers, reset failure counts
    if (this.currentIndex === 0) {
      logger.warn('All RPC providers failed, resetting failure counts');
      this.failureCount.clear();
    }

    this.initializeProvider();
  }

  async executeWithFailover<T>(
    operation: (provider: ethers.JsonRpcProvider) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const provider = await this.getProvider();
        const result = await operation(provider);
        
        // Reset failure count on success
        const currentProvider = this.providers[this.currentIndex];
        this.failureCount.set(currentProvider.name, 0);
        
        return result;
      } catch (error: any) {
        lastError = error;
        logger.error('RPC operation failed', {
          attempt: attempt + 1,
          maxRetries,
          error: error.message
        });

        if (attempt < maxRetries - 1) {
          await this.failover();
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    logger.critical('All RPC failover attempts exhausted', { error: lastError });
    throw new Error(`RPC operation failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  getProviderStatus() {
    return this.providers.map(provider => ({
      name: provider.name,
      priority: provider.priority,
      failures: this.failureCount.get(provider.name) || 0,
      active: this.providers[this.currentIndex].name === provider.name
    }));
  }
}

// Default providers configuration
export const createDefaultRPCService = (chainId: number): RPCFailoverService => {
  const providers: RPCProvider[] = [];

  // These should be configured via environment variables in production
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY;
  const infuraKey = import.meta.env.VITE_INFURA_API_KEY;
  const quicknodeUrl = import.meta.env.VITE_QUICKNODE_RPC_URL;

  if (alchemyKey) {
    providers.push({
      name: 'Alchemy',
      url: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      priority: 1,
      timeout: 10000
    });
  }

  if (infuraKey) {
    providers.push({
      name: 'Infura',
      url: `https://mainnet.infura.io/v3/${infuraKey}`,
      priority: 2,
      timeout: 10000
    });
  }

  if (quicknodeUrl) {
    providers.push({
      name: 'QuickNode',
      url: quicknodeUrl,
      priority: 3,
      timeout: 10000
    });
  }

  // Fallback to public RPC (not recommended for production)
  if (providers.length === 0) {
    logger.warn('No premium RPC providers configured, using public RPC');
    providers.push({
      name: 'Public RPC',
      url: 'https://eth.llamarpc.com',
      priority: 99,
      timeout: 15000
    });
  }

  return new RPCFailoverService(providers);
};
