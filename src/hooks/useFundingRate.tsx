import { useState, useEffect } from 'react';
import { dydxMarketService } from '@/services/dydxMarketService';

interface FundingRateData {
  fundingRate: number;
  nextFundingTime: number | null;
  annualizedRate: number;
}

export const useFundingRate = (market: string | null) => {
  const [data, setData] = useState<FundingRateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!market) {
      setData(null);
      return;
    }

    const fetchFundingRate = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await dydxMarketService.getFundingRate(market);
        setData({
          ...result,
          annualizedRate: result.fundingRate * 365 * 3, // 8-hour funding * 3 per day
        });
      } catch (err) {
        console.error('[useFundingRate] Error fetching funding rate:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch funding rate');
      } finally {
        setLoading(false);
      }
    };

    fetchFundingRate();

    // Refresh every minute
    const interval = setInterval(fetchFundingRate, 60000);
    return () => clearInterval(interval);
  }, [market]);

  const formatTimeUntil = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) return 'Soon';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return {
    fundingRate: data?.fundingRate || 0,
    nextFundingTime: data?.nextFundingTime || null,
    annualizedRate: data?.annualizedRate || 0,
    formatTimeUntil,
    loading,
    error,
  };
};
