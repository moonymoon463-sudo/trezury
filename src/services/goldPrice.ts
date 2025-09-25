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
  private lastNotifiedPrice: number = 0;
  private readonly PRICE_CHANGE_THRESHOLD = 0.001; // 0.1% threshold
  private isUpdating = false; // Prevent duplicate intervals

  async getCurrentPrice(): Promise<GoldPrice> {
    try {
      // First, try to get the latest price from database
      const { data: dbPrice, error: dbError } = await supabase
        .from('gold_prices')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (dbPrice && !dbError) {
        console.log('✅ Using database-stored gold price');
        const goldPrice: GoldPrice = {
          usd_per_oz: Number(dbPrice.usd_per_oz),
          usd_per_gram: Number(dbPrice.usd_per_gram),
          change_24h: Number(dbPrice.change_24h || 0),
          change_percent_24h: Number(dbPrice.change_percent_24h || 0),
          last_updated: new Date(dbPrice.timestamp).getTime()
        };
        
        this.currentPrice = goldPrice;
        this.notifySubscribers(goldPrice);
        return goldPrice;
      }

      console.log('📡 Database empty, falling back to live APIs');
      
      // Fallback to live APIs if database is empty or outdated
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
    // Use realistic current gold price (around $2650/oz as of late 2024)
    const basePrice = 2650;
    const variation = (Math.random() - 0.5) * 20; // ±$10 variation
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
    // Only notify if price changed significantly
    const priceChange = Math.abs(price.usd_per_oz - this.lastNotifiedPrice) / this.lastNotifiedPrice;
    if (this.lastNotifiedPrice === 0 || priceChange >= this.PRICE_CHANGE_THRESHOLD) {
      this.lastNotifiedPrice = price.usd_per_oz;
      this.subscribers.forEach(callback => callback(price));
    }
  }

  startRealTimeUpdates(intervalMs: number = 300000): void {
    // Prevent multiple intervals
    if (this.isUpdating) {
      return;
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.isUpdating = true;

    // Get initial price
    this.getCurrentPrice();

    // Set up periodic updates (default 5 minutes for stability)
    this.updateInterval = window.setInterval(() => {
      this.getCurrentPrice();
    }, intervalMs);
  }

  stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isUpdating = false;
  }

  async getHistoricalPrices(timeframe: '1h' | '24h' | '7d' | '30d' | '3m' = '24h'): Promise<GoldPriceHistory[]> {
    const history: GoldPriceHistory[] = [];
    const now = new Date();
    
    // Use current price as reference, fallback to realistic price
    const currentPrice = this.currentPrice?.usd_per_oz || 2650;
    
    let intervals: number;
    let intervalMs: number;
    let volatilityFactor: number;
    
    switch (timeframe) {
      case '1h':
        intervals = 60; // Every minute for 1 hour
        intervalMs = 60 * 1000;
        volatilityFactor = 0.001; // 0.1% per minute max
        break;
      case '24h':
        intervals = 144; // Every 10 minutes for 24 hours
        intervalMs = 10 * 60 * 1000;
        volatilityFactor = 0.003; // 0.3% per 10-minute interval
        break;
      case '7d':
        intervals = 168; // Every hour for 7 days
        intervalMs = 60 * 60 * 1000;
        volatilityFactor = 0.008; // 0.8% per hour
        break;
      case '30d':
        intervals = 180; // Every 4 hours for 30 days
        intervalMs = 4 * 60 * 60 * 1000;
        volatilityFactor = 0.015; // 1.5% per 4-hour period
        break;
      case '3m':
        intervals = 90; // Every day for 3 months
        intervalMs = 24 * 60 * 60 * 1000;
        volatilityFactor = 0.025; // 2.5% daily volatility
        break;
      default:
        intervals = 144;
        intervalMs = 10 * 60 * 1000;
        volatilityFactor = 0.003;
    }

    // Generate realistic price movements
    let price = currentPrice;
    let trend = 0; // Overall trend direction
    
    for (let i = intervals; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * intervalMs));
      
      // Add some trending behavior (gold tends to trend over time)
      if (Math.random() < 0.1) { // 10% chance to change trend
        trend = (Math.random() - 0.5) * 0.02; // ±1% trend per period
      }
      
      // Market hours volatility (higher during US/London trading)
      const hour = timestamp.getUTCHours();
      const isMarketHours = (hour >= 13 && hour <= 20); // 8 AM - 3 PM EST in UTC
      const hourVolatilityMultiplier = isMarketHours ? 1.5 : 0.7;
      
      // Weekend reduced volatility
      const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6;
      const weekendMultiplier = isWeekend ? 0.5 : 1.0;
      
      // Generate price movement with trend + random walk + volatility clustering
      const randomComponent = (Math.random() - 0.5) * volatilityFactor * hourVolatilityMultiplier * weekendMultiplier;
      const trendComponent = trend;
      
      // Occasional spikes (news events, etc.)
      const spikeChance = Math.random();
      const spikeComponent = spikeChance < 0.005 ? (Math.random() - 0.5) * 0.03 : 0; // 0.5% chance of ±3% spike
      
      price = price * (1 + trendComponent + randomComponent + spikeComponent);
      
      // Keep price within reasonable bounds ($2000-$4000)
      price = Math.max(2000, Math.min(4000, price));
      
      history.push({
        timestamp: timestamp.toISOString(),
        price: Number(price.toFixed(2))
      });
    }

    // Sort by timestamp (oldest first)
    return history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}

export const goldPriceService = new GoldPriceService();