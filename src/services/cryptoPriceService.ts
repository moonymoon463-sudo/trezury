import { supabase } from "@/integrations/supabase/client";

export interface CryptoPrices {
  ETH: number;
  BTC: number;
  USDC: number;
  lastUpdated: number;
}

class CryptoPriceService {
  private currentPrices: CryptoPrices | null = null;
  private subscribers: Set<(prices: CryptoPrices) => void> = new Set();
  private updateInterval: number | null = null;
  private inflightFetch: Promise<CryptoPrices> | null = null;
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds cache
  private lastFetchTime = 0;

  async getCurrentPrices(): Promise<CryptoPrices> {
    // Return cached prices if still fresh
    if (this.currentPrices && Date.now() - this.lastFetchTime < this.CACHE_TTL) {
      return this.currentPrices;
    }

    // Deduplicate concurrent requests
    if (this.inflightFetch) {
      return this.inflightFetch;
    }

    // Create new fetch promise
    this.inflightFetch = this.fetchPrices();
    
    try {
      const prices = await this.inflightFetch;
      return prices;
    } finally {
      this.inflightFetch = null;
    }
  }

  private async fetchPrices(): Promise<CryptoPrices> {
    try {
      // Fetch both ETH and BTC prices from CoinGecko
      const pricesPromise = fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd')
        .then(res => res.json());

      const pricesResult = await pricesPromise;

      let ethPrice = 2800; // Fallback
      let btcPrice = 43000; // Fallback

      // Process prices
      if (pricesResult?.ethereum?.usd) {
        ethPrice = Number(pricesResult.ethereum.usd);
        console.log(`✅ ETH Price from CoinGecko: $${ethPrice}`);
      } else {
        console.warn('⚠️ Failed to fetch ETH price from CoinGecko, using fallback');
      }

      if (pricesResult?.bitcoin?.usd) {
        btcPrice = Number(pricesResult.bitcoin.usd);
        console.log(`✅ BTC Price from CoinGecko: $${btcPrice}`);
      } else {
        console.warn('⚠️ Failed to fetch BTC price from CoinGecko, using fallback');
      }

      const cryptoPrices: CryptoPrices = {
        ETH: ethPrice,
        BTC: btcPrice,
        USDC: 1.00, // Stablecoin always $1
        lastUpdated: Date.now()
      };

      this.currentPrices = cryptoPrices;
      this.lastFetchTime = Date.now();
      this.notifySubscribers(cryptoPrices);

      return cryptoPrices;

    } catch (error) {
      console.error('Failed to fetch crypto prices:', error);
      
      // Return cached prices if available
      if (this.currentPrices) {
        return this.currentPrices;
      }

      // Last resort fallback
      return {
        ETH: 2800,
        BTC: 43000,
        USDC: 1.00,
        lastUpdated: Date.now()
      };
    }
  }

  subscribe(callback: (prices: CryptoPrices) => void): () => void {
    this.subscribers.add(callback);
    
    // Send current prices immediately if available
    if (this.currentPrices) {
      callback(this.currentPrices);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(prices: CryptoPrices): void {
    this.subscribers.forEach(callback => callback(prices));
  }

  startRealTimeUpdates(intervalMs: number = 30000): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Get initial prices
    this.getCurrentPrices();

    // Set up periodic updates (default 30 seconds)
    this.updateInterval = window.setInterval(() => {
      // Force cache invalidation for periodic updates
      this.lastFetchTime = 0;
      this.getCurrentPrices();
    }, intervalMs);
  }

  stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const cryptoPriceService = new CryptoPriceService();
