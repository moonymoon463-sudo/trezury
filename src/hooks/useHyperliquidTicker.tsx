import { useState, useEffect } from 'react';
import { hyperliquidMarketService } from '@/services/hyperliquidMarketService';

export const useHyperliquidTicker = (refreshInterval: number = 5000) => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchPrices = async () => {
      try {
        const allMids = await hyperliquidMarketService.getAllMids();
        
        if (mounted) {
          // Convert string prices to numbers
          const numericPrices = Object.entries(allMids).reduce((acc, [key, value]) => {
            acc[key] = parseFloat(value as string);
            return acc;
          }, {} as Record<string, number>);
          
          setPrices(numericPrices);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch prices');
          setLoading(false);
        }
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshInterval]);

  return { prices, loading, error };
};
