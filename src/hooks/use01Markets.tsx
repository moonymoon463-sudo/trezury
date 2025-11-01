/**
 * React hook for 01 Protocol market data
 */

import { useState, useEffect } from 'react';
import { zoTradingService } from '@/exchanges/01protocol/tradingService';

export interface Market01 {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  volume24h: number;
  change24h: number;
}

export const use01Markets = () => {
  const [markets, setMarkets] = useState<Market01[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarkets();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMarkets = async () => {
    try {
      const data = await zoTradingService.getMarkets();
      setMarkets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  };

  return {
    markets,
    loading,
    error,
    refetch: fetchMarkets,
  };
};
