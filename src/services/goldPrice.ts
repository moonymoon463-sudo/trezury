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
    // Always rely on DB-backed data; if stale/missing, invoke collector
    // No synthetic fallbacks
    const fetchFromDb = async () => {
      const { data: dbPrice } = await supabase
        .from('gold_prices')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      return dbPrice;
    };

    // Try current DB price
    let dbPrice = await fetchFromDb();

    const isFresh = (ts: string | null | undefined) => {
      if (!ts) return false;
      const ageMs = Date.now() - new Date(ts).getTime();
      return ageMs < 7 * 60 * 1000; // 7 minutes
    };

    if (dbPrice && isFresh(dbPrice.timestamp)) {
      const goldPrice: GoldPrice = {
        usd_per_oz: Number(dbPrice.usd_per_oz),
        usd_per_gram: Number(dbPrice.usd_per_gram),
        change_24h: Number(dbPrice.change_24h || 0),
        change_percent_24h: Number(dbPrice.change_percent_24h || 0),
        last_updated: new Date(dbPrice.timestamp).getTime(),
      };
      this.currentPrice = goldPrice;
      this.notifySubscribers(goldPrice);
      return goldPrice;
    }

    // Refresh via collector and re-read
    try {
      await supabase.functions.invoke('gold-price-collector', { body: { reason: 'refresh' } });
    } catch (e) {
      console.warn('Collector invocation failed:', e);
    }

    dbPrice = await fetchFromDb();
    if (dbPrice) {
      const goldPrice: GoldPrice = {
        usd_per_oz: Number(dbPrice.usd_per_oz),
        usd_per_gram: Number(dbPrice.usd_per_gram),
        change_24h: Number(dbPrice.change_24h || 0),
        change_percent_24h: Number(dbPrice.change_percent_24h || 0),
        last_updated: new Date(dbPrice.timestamp).getTime(),
      };
      this.currentPrice = goldPrice;
      this.notifySubscribers(goldPrice);
      return goldPrice;
    }

    throw new Error('No current gold price available');
  }

  // Removed mock price generation to ensure real data only


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
    // Only DB-backed historical data; if missing, trigger backfill
    // No synthetic data generation
    console.log(`📊 Getting historical data for timeframe: ${timeframe}`);
    
    // Calculate date range based on timeframe
    let daysBack = 1;
    switch (timeframe) {
      case '1h':
        daysBack = 2; // get at least 2 days to ensure latest close exists
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

    const fetchFromDb = async () => {
      console.log(`🔍 Fetching from DB since: ${startDateStr}`);
      const { data } = await supabase
        .from('gold_price_history')
        .select('*')
        .gte('date', startDateStr)
        .order('date', { ascending: true });
      console.log(`📦 DB returned ${data?.length || 0} historical entries`);
      return data || [];
    };

    let historicalData = await fetchFromDb();

    if (!historicalData || historicalData.length === 0) {
      console.log('🔄 No historical data found, triggering backfill...');
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Historical backfill timeout')), 10000); // 10 second timeout
        });
        
        const backfillPromise = supabase.functions.invoke('gold-price-historical', { 
          body: { reason: 'backfill', timeframe } 
        });
        
        await Promise.race([backfillPromise, timeoutPromise]);
        console.log('✅ Backfill completed, refetching...');
      } catch (e) {
        console.warn('⚠️ Historical backfill failed or timed out:', e);
        // Don't throw here, just return empty data to prevent chart from hanging
      }
      
      historicalData = await fetchFromDb();
    }

    const result = (historicalData || []).map(entry => ({
      date: entry.date,
      open: entry.open_price,
      high: entry.high_price,
      low: entry.low_price,
      close: entry.close_price,
      volume: entry.volume || 0
    }));
    
    console.log(`📈 Returning ${result.length} historical data entries`);
    return result;
  }

  // Removed synthetic historical data generation to ensure accuracy

  async getHistoricalPrices(timeframe: '1h' | '24h' | '7d' | '30d' | '3m' = '24h'): Promise<GoldPriceHistory[]> {
    console.log(`📊 Getting historical prices for timeframe: ${timeframe}`);
    
    try {
      const historicalData = await this.getHistoricalData(timeframe);
      console.log(`📈 Historical data entries found: ${historicalData.length}`);

      const chartData: GoldPriceHistory[] = historicalData.map(entry => ({
        timestamp: new Date(entry.date + 'T12:00:00Z').toISOString(),
        price: entry.close
      }));

      // Append latest current price as final point if more recent
      try {
        const current = await this.getCurrentPrice();
        const nowIso = new Date().toISOString();
        chartData.push({ timestamp: nowIso, price: current.usd_per_oz });
        console.log(`✅ Added current price point: $${current.usd_per_oz}`);
      } catch (error) {
        console.warn('⚠️ Could not fetch current price for chart:', error);
      }

      const finalData = chartData.slice(-this.getMaxPoints(timeframe));
      console.log(`📊 Returning ${finalData.length} chart data points`);
      return finalData;
    } catch (error) {
      console.error('❌ Error in getHistoricalPrices:', error);
      // Return empty array instead of throwing to prevent chart from getting stuck
      return [];
    }
  }

  // Removed synthetic chart data generation to ensure accuracy

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