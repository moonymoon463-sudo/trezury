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
      // Fetch ETH price from Chainlink oracle via blockchain-operations
      const ethPromise = supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_eth_price'
        }
      });

      // Fetch BTC price from CoinGecko (same API used for XAUT)
      const btcPromise = fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
        .then(res => res.json());

      const [ethResult, btcResult] = await Promise.allSettled([ethPromise, btcPromise]);

      let ethPrice = 2800; // Fallback
      let btcPrice = 43000; // Fallback

      // Process ETH price
      if (ethResult.status === 'fulfilled' && ethResult.value.data?.success) {
        ethPrice = Number(ethResult.value.data.price);
        console.log(`✅ ETH Price from Chainlink: $${ethPrice}`);
      } else {
        console.warn('⚠️ Failed to fetch ETH price from Chainlink, using fallback');
      }

      // Process BTC price
      if (btcResult.status === 'fulfilled' && btcResult.value?.bitcoin?.usd) {
        btcPrice = Number(btcResult.value.bitcoin.usd);
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
