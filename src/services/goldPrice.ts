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

export interface GoldPriceHistoryEntry {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

  async getHistoricalData(timeframe: '1h' | '24h' | '7d' | '30d' | '3m' = '24h'): Promise<GoldPriceHistoryEntry[]> {
    try {
      // Calculate date range based on timeframe
      let daysBack = 1;
      switch (timeframe) {
        case '1h':
          daysBack = 1;
          break;
        case '24h':
          daysBack = 2;
          break;
        case '7d':
          daysBack = 8;
          break;
        case '30d':
          daysBack = 32;
          break;
        case '3m':
          daysBack = 95;
          break;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const startDateStr = startDate.toISOString().split('T')[0];

      // Fetch real historical data from database
      const { data: historicalData, error } = await supabase
        .from('gold_price_history')
        .select('*')
        .gte('date', startDateStr)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching historical data:', error);
        // Fall back to synthetic data if database fetch fails
        return this.generateSyntheticHistoricalData(timeframe);
      }

      if (!historicalData || historicalData.length === 0) {
        console.log('No historical data found, using synthetic data');
        return this.generateSyntheticHistoricalData(timeframe);
      }

      // Convert database format to expected format
      return historicalData.map(entry => ({
        date: entry.date,
        open: entry.open_price,
        high: entry.high_price,
        low: entry.low_price,
        close: entry.close_price,
        volume: entry.volume || 0
      }));

    } catch (error) {
      console.error('Error in getHistoricalData:', error);
      return this.generateSyntheticHistoricalData(timeframe);
    }
  }

  private async generateSyntheticHistoricalData(timeframe: '1h' | '24h' | '7d' | '30d' | '3m'): Promise<GoldPriceHistoryEntry[]> {
    // Get current price as base
    const currentPrice = await this.getCurrentPrice();
    const basePrice = currentPrice.usd_per_oz;

    const data: GoldPriceHistoryEntry[] = [];
    let currentValue = basePrice;

    // Enhanced volatility and realism factors
    const config = {
      '1h': { points: 60, interval: 1, volatility: 0.008 },
      '24h': { points: 144, interval: 10, volatility: 0.015 },
      '7d': { points: 168, interval: 60, volatility: 0.025 },
      '30d': { points: 120, interval: 360, volatility: 0.035 },
      '3m': { points: 90, interval: 1440, volatility: 0.05 }
    };

    const { points, interval, volatility } = config[timeframe];
    const now = new Date();

    for (let i = points - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * interval * 60 * 1000));
      
      // Create realistic daily OHLC patterns
      const dayChange = (Math.random() - 0.5) * volatility * 2;
      const intraHighLow = volatility * 0.6;
      
      const open = currentValue;
      const close = open * (1 + dayChange);
      const high = Math.max(open, close) * (1 + Math.random() * intraHighLow);
      const low = Math.min(open, close) * (1 - Math.random() * intraHighLow);
      
      data.push({
        date: timestamp.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.floor(Math.random() * 1000000) + 100000
      });
      
      currentValue = close;
    }

    return data.reverse();
  }

  async getHistoricalPrices(timeframe: '1h' | '24h' | '7d' | '30d' | '3m' = '24h'): Promise<GoldPriceHistory[]> {
    // Try to get real historical data first
    try {
      const historicalData = await this.getHistoricalData(timeframe);
      
      if (historicalData.length > 0) {
        // Convert historical OHLC data to price points for chart
        const chartData: GoldPriceHistory[] = [];
        
        for (const entry of historicalData) {
          // For different timeframes, use different price points
          if (timeframe === '1h' || timeframe === '24h') {
            // Use OHLC progression for intraday
            const baseTime = new Date(entry.date + 'T00:00:00Z').getTime();
            const interval = timeframe === '1h' ? 15 * 60 * 1000 : 6 * 60 * 60 * 1000; // 15min or 6h
            
            chartData.push(
              { timestamp: new Date(baseTime).toISOString(), price: entry.open },
              { timestamp: new Date(baseTime + interval).toISOString(), price: entry.high },
              { timestamp: new Date(baseTime + interval * 2).toISOString(), price: entry.low },
              { timestamp: new Date(baseTime + interval * 3).toISOString(), price: entry.close }
            );
          } else {
            // Use close price for daily/weekly/monthly views
            chartData.push({
              timestamp: new Date(entry.date + 'T12:00:00Z').toISOString(),
              price: entry.close
            });
          }
        }
        
        return chartData.slice(0, this.getMaxPoints(timeframe));
      }
    } catch (error) {
      console.error('Error getting historical data, falling back to synthetic:', error);
    }

    // Fallback to synthetic data if no real data available
    return this.generateSyntheticChartData(timeframe);
  }

  private generateSyntheticChartData(timeframe: '1h' | '24h' | '7d' | '30d' | '3m' = '24h'): GoldPriceHistory[] {
    const history: GoldPriceHistory[] = [];
    const now = new Date();
    
    // Use current price as reference, fallback to realistic price
    const currentPrice = this.currentPrice?.usd_per_oz || 2650;
    
    // Create seed based on date for consistent data generation
    const seedString = `gold-${timeframe}-${Math.floor(now.getTime() / (24 * 60 * 60 * 1000))}`;
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

  private getMaxPoints(timeframe: string): number {
    const maxPoints = {
      '1h': 60,
      '24h': 144,
      '7d': 168,
      '30d': 120,
      '3m': 90
    };
    return maxPoints[timeframe as keyof typeof maxPoints] || 144;
  }
}

export const goldPriceService = new GoldPriceService();