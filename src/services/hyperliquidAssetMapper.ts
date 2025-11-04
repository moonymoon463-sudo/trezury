import { HYPERLIQUID_API } from '@/config/hyperliquid';

export interface MarketMetadata {
  name: string;
  assetIndex: number;
  szDecimals: number;
}

class HyperliquidAssetMapper {
  private assetMap: Map<string, MarketMetadata> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Fetch market metadata from Hyperliquid /info endpoint
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._fetchMetadata();
    await this.initPromise;
  }

  private async _fetchMetadata(): Promise<void> {
    try {
      const response = await fetch(`${HYPERLIQUID_API.restEndpoint}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Hyperliquid metadata: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse universe array
      if (data.universe && Array.isArray(data.universe)) {
        data.universe.forEach((asset: any, index: number) => {
          this.assetMap.set(asset.name, {
            name: asset.name,
            assetIndex: index,
            szDecimals: asset.szDecimals || 0
          });
        });
      }

      this.initialized = true;
      console.log(`[HyperliquidAssetMapper] Loaded ${this.assetMap.size} markets`);
    } catch (error) {
      console.error('[HyperliquidAssetMapper] Failed to initialize:', error);
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Get asset index for a given market symbol
   * @param market - Market symbol (e.g., "BTC", "ETH", "SOL")
   * @returns Asset index for use in order actions
   */
  getAssetIndex(market: string): number {
    if (!this.initialized) {
      throw new Error('HyperliquidAssetMapper not initialized. Call initialize() first.');
    }

    const metadata = this.assetMap.get(market);
    if (!metadata) {
      throw new Error(`Unknown market: ${market}. Available markets: ${Array.from(this.assetMap.keys()).join(', ')}`);
    }

    return metadata.assetIndex;
  }

  /**
   * Get full market metadata
   */
  getMarketMetadata(market: string): MarketMetadata {
    if (!this.initialized) {
      throw new Error('HyperliquidAssetMapper not initialized. Call initialize() first.');
    }

    const metadata = this.assetMap.get(market);
    if (!metadata) {
      throw new Error(`Unknown market: ${market}`);
    }

    return metadata;
  }

  /**
   * Get all available markets
   */
  getAllMarkets(): MarketMetadata[] {
    if (!this.initialized) {
      throw new Error('HyperliquidAssetMapper not initialized. Call initialize() first.');
    }

    return Array.from(this.assetMap.values());
  }

  /**
   * Format order size with correct decimals
   */
  formatSize(market: string, size: number): string {
    const metadata = this.getMarketMetadata(market);
    return size.toFixed(metadata.szDecimals);
  }

  /**
   * Format price (typically 5 decimals for most markets)
   */
  formatPrice(price: number, decimals: number = 5): string {
    return price.toFixed(decimals);
  }
}

export const hyperliquidAssetMapper = new HyperliquidAssetMapper();
