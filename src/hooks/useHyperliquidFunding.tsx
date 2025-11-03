import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FundingRateData {
  fundingRate: number;
  annualizedRate: number;
  nextFundingTime: number | null;
}

export const useHyperliquidFunding = (market: string | null) => {
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
        const { data: result, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
          body: {
            operation: 'get_funding',
            params: { market }
          }
        });

        if (funcError) throw funcError;

        const fundingRate = parseFloat(result.fundingRate || '0');
        
        setData({
          fundingRate,
          annualizedRate: fundingRate * 365 * 3, // 8-hour funding * 3 per day
          nextFundingTime: Date.now() + (8 * 60 * 60 * 1000) // Next funding in 8 hours
        });
      } catch (err) {
        console.error('[useHyperliquidFunding] Error:', err);
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
