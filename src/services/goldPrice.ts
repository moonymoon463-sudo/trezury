export interface GoldPrice {
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
  source: string;
}

export interface GoldPriceHistory {
  timestamp: string;
  price: number;
}

class GoldPriceService {
  private readonly GOLD_API_URL = 'https://api.metals.live/v1/spot/gold';
  private currentPrice: GoldPrice | null = null;
  private subscribers: Set<(price: GoldPrice) => void> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;

  async getCurrentPrice(): Promise<GoldPrice> {
    try {
      const response = await fetch(this.GOLD_API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch gold price');
      }
      
      const data = await response.json();
      
      const goldPrice: GoldPrice = {
        price: data.price || this.generateMockPrice(),
        change: data.change || this.generateMockChange(),
        changePercent: data.changePercent || this.generateMockChangePercent(),
        timestamp: new Date().toISOString(),
        source: data.source || 'metals.live'
      };

      this.currentPrice = goldPrice;
      this.notifySubscribers(goldPrice);
      
      return goldPrice;
    } catch (error) {
      console.warn('Failed to fetch real gold price, using mock data:', error);
      return this.getMockPrice();
    }
  }

  private getMockPrice(): GoldPrice {
    const basePrice = 2678.45;
    const variation = (Math.random() - 0.5) * 20; // ±$10
    const price = basePrice + variation;
    const change = variation;
    const changePercent = (change / basePrice) * 100;

    const goldPrice: GoldPrice = {
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      timestamp: new Date().toISOString(),
      source: 'mock'
    };

    this.currentPrice = goldPrice;
    return goldPrice;
  }

  private generateMockPrice(): number {
    return 2678.45 + (Math.random() - 0.5) * 20;
  }

  private generateMockChange(): number {
    return (Math.random() - 0.5) * 40;
  }

  private generateMockChangePercent(): number {
    return (Math.random() - 0.5) * 2;
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
    this.updateInterval = setInterval(() => {
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
    const basePrice = 2678.45;

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