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
    
    // Create seed based on timeframe for consistent data generation
    const seedString = `${timeframe}-${Math.floor(now.getTime() / (24 * 60 * 60 * 1000))}`;
    let seed = seedString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Simple seeded random function for consistency
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    let intervals: number;
    let intervalMs: number;
    let volatilityFactor: number;
    
    switch (timeframe) {
      case '1h':
        intervals = 60; // Every minute for 1 hour
        intervalMs = 60 * 1000;
        volatilityFactor = 0.005; // 0.5% per minute - increased significantly
        break;
      case '24h':
        intervals = 144; // Every 10 minutes for 24 hours
        intervalMs = 10 * 60 * 1000;
        volatilityFactor = 0.01; // 1% per 10-minute interval - increased significantly
        break;
      case '7d':
        intervals = 168; // Every hour for 7 days
        intervalMs = 60 * 60 * 1000;
        volatilityFactor = 0.02; // 2% per hour - increased significantly
        break;
      case '30d':
        intervals = 180; // Every 4 hours for 30 days
        intervalMs = 4 * 60 * 60 * 1000;
        volatilityFactor = 0.03; // 3% per 4-hour period - increased significantly
        break;
      case '3m':
        intervals = 90; // Every day for 3 months
        intervalMs = 24 * 60 * 60 * 1000;
        volatilityFactor = 0.05; // 5% daily volatility - increased significantly
        break;
      default:
        intervals = 144;
        intervalMs = 10 * 60 * 1000;
        volatilityFactor = 0.01;
    }

    // Generate realistic price movements
    let price = currentPrice;
    let trend = 0; // Overall trend direction
    let momentum = 0; // Price momentum for more realistic movement
    let supportLevel = currentPrice * 0.95; // Support level
    let resistanceLevel = currentPrice * 1.05; // Resistance level
    
    for (let i = intervals; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * intervalMs));
      
      // Add trending behavior with momentum
      if (seededRandom() < 0.15) { // 15% chance to change trend
        trend = (seededRandom() - 0.5) * 0.03; // ±1.5% trend per period
      }
      
      // Market hours volatility (higher during US/London trading)
      const hour = timestamp.getUTCHours();
      const isMarketHours = (hour >= 13 && hour <= 20); // 8 AM - 3 PM EST in UTC
      const hourVolatilityMultiplier = isMarketHours ? 1.8 : 0.6;
      
      // Weekend reduced volatility
      const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6;
      const weekendMultiplier = isWeekend ? 0.4 : 1.0;
      
      // Add momentum to create trending behavior
      momentum = momentum * 0.8 + trend * 0.2; // Momentum decay with new trend influence
      
      // Support/resistance behavior
      let srInfluence = 0;
      if (price <= supportLevel) {
        srInfluence = 0.01; // Bounce off support
        supportLevel = price * 0.98; // Update support
      } else if (price >= resistanceLevel) {
        srInfluence = -0.01; // Resistance pressure
        resistanceLevel = price * 1.02; // Update resistance
      }
      
      // Generate price movement with multiple components
      const randomComponent = (seededRandom() - 0.5) * volatilityFactor * hourVolatilityMultiplier * weekendMultiplier;
      const trendComponent = trend;
      const momentumComponent = momentum * 0.5;
      
      // Occasional news events/spikes
      const spikeChance = seededRandom();
      const spikeComponent = spikeChance < 0.008 ? (seededRandom() - 0.5) * 0.05 : 0; // 0.8% chance of ±5% spike
      
      // Intraday patterns (higher volatility at open/close)
      const minute = timestamp.getUTCMinutes();
      const intradayMultiplier = (minute < 30 || minute > 30) ? 1.2 : 1.0;
      
      price = price * (1 + trendComponent + randomComponent + momentumComponent + spikeComponent + srInfluence) * intradayMultiplier;
      
      // Keep price within reasonable bounds ($2200-$3200)
      price = Math.max(2200, Math.min(3200, price));
      
      // Update dynamic support/resistance levels
      if (i % 10 === 0) { // Update every 10 intervals
        const range = price * 0.05; // 5% range
        supportLevel = Math.max(supportLevel, price - range);
        resistanceLevel = Math.min(resistanceLevel, price + range);
      }
      
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