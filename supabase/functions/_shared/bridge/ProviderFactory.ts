/**
 * Factory for creating bridge provider instances
 */

import type { BridgeProvider } from './types.ts';
import { AcrossProvider } from './AcrossProvider.ts';
import { WormholeProvider } from './WormholeProvider.ts';

export class ProviderFactory {
  private static providers: Map<string, BridgeProvider> = new Map();

  /**
   * Get provider instance (singleton per provider type)
   */
  static getProvider(providerName: 'across' | 'wormhole'): BridgeProvider {
    if (!this.providers.has(providerName)) {
      switch (providerName) {
        case 'across':
          this.providers.set(providerName, new AcrossProvider());
          break;
        case 'wormhole':
          this.providers.set(providerName, new WormholeProvider());
          break;
        default:
          throw new Error(`Unknown provider: ${providerName}`);
      }
    }

    return this.providers.get(providerName)!;
  }

  /**
   * Get all available providers
   */
  static getAllProviders(): BridgeProvider[] {
    return [
      this.getProvider('across'),
      this.getProvider('wormhole'),
    ];
  }

  /**
   * Check if a provider supports a specific chain
   */
  static supportsChain(providerName: string, chain: string): boolean {
    try {
      const provider = this.getProvider(providerName as 'across' | 'wormhole');
      return provider.getSupportedChains().includes(chain);
    } catch {
      return false;
    }
  }
}
