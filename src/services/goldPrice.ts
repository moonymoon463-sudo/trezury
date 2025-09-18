import { supabase } from "@/integrations/supabase/client";

export interface GoldPrice {
  usd_per_oz: number;
  usd_per_gram: number;
  change_24h: number;
  change_percent_24h: number;
  last_updated: number;
}

export interface GoldPriceHistory {
  timestamp: string;
  price: number;
}

class GoldPriceService {
  private currentPrice: GoldPrice | null = null;
  private subscribers: Set<(price: GoldPrice) => void> = new Set();
  private updateInterval: number | null = null;

  async getCurrentPrice(): Promise<GoldPrice> {
    try {
      // Try new metals price API first, fallback to original
      const { data, error } = await supabase.functions.invoke('metals-price-api');
      
      if (error) {
        console.error('Metals price API error:', error);
        // Fallback to original gold-price-api
        try {
          const fallbackResult = await supabase.functions.invoke('gold-price-api');
          if (fallbackResult.data?.gold) {
            this.currentPrice = fallbackResult.data.gold;
            this.notifySubscribers(fallbackResult.data.gold);
            return fallbackResult.data.gold;
          }
        } catch (fallbackError) {
          console.error('Fallback API also failed:', fallbackError);
        }
        return this.getMockPrice();
      }

      if (data?.gold) {
        this.currentPrice = data.gold;
        this.notifySubscribers(data.gold);
        return data.gold;
      }

      return this.getMockPrice();
    } catch (error) {
      console.warn('Failed to fetch real gold price, using mock data:', error);
      return this.getMockPrice();
    }
  }

  private getMockPrice(): GoldPrice {
    const basePrice = 2345.67;
    const variation = (Math.random() - 0.5) * 20; // ±$10
    const price = basePrice + variation;
    const change = variation;
    const changePercent = (change / basePrice) * 100;

    const goldPrice: GoldPrice = {
      usd_per_oz: Number(price.toFixed(2)),
      usd_per_gram: Number((price / 31.1035).toFixed(2)),
      change_24h: Number(change.toFixed(2)),
      change_percent_24h: Number(changePercent.toFixed(2)),
      last_updated: Date.now()
    };

    this.currentPrice = goldPrice;
    return goldPrice;
  }


  subscribe(callback: (price: GoldPrice) => void): () => void {
    this.subscribers.add(callback);
    
    // Send current price immediately if available
    if (this.currentPrice) {
      callback(this.currentPrice);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(price: GoldPrice): void {
    this.subscribers.forEach(callback => callback(price));
  }

  startRealTimeUpdates(intervalMs: number = 30000): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Get initial price
    this.getCurrentPrice();

    // Set up periodic updates
    this.updateInterval = window.setInterval(() => {
      this.getCurrentPrice();
    }, intervalMs);
  }

  stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async getHistoricalPrices(days: number = 30): Promise<GoldPriceHistory[]> {
    // For now, generate mock historical data
    const history: GoldPriceHistory[] = [];
    const now = new Date();
    const basePrice = 2345.67;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const variation = (Math.random() - 0.5) * 100;
      const price = basePrice + variation;
      
      history.push({
        timestamp: date.toISOString(),
        price: Number(price.toFixed(2))
      });
    }

    return history;
  }
}

export const goldPriceService = new GoldPriceService();