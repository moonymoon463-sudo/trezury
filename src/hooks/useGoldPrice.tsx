import { useState, useEffect } from 'react';
import { goldPriceService, GoldPrice } from '@/services/goldPrice';

export const useGoldPrice = () => {
  const [price, setPrice] = useState<GoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadInitialPrice = async () => {
      try {
        setLoading(true);
        setError(null);
        const currentPrice = await goldPriceService.getCurrentPrice();
        if (mounted) {
          setPrice(currentPrice);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load gold price');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Subscribe to real-time updates
    const unsubscribe = goldPriceService.subscribe((newPrice) => {
      if (mounted) {
        setPrice(newPrice);
        setLoading(false);
        setError(null);
      }
    });

    // Start real-time updates (every 30 seconds)
    goldPriceService.startRealTimeUpdates(30000);

    // Load initial price
    loadInitialPrice();

    return () => {
      mounted = false;
      unsubscribe();
      goldPriceService.stopRealTimeUpdates();
    };
  }, []);

  const refreshPrice = async () => {
    try {
      setLoading(true);
      setError(null);
      await goldPriceService.getCurrentPrice();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh price');
    } finally {
      setLoading(false);
    }
  };

  return {
    price,
    loading,
    error,
    refreshPrice
  };
};