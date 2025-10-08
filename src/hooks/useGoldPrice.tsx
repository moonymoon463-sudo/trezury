import { useState, useEffect } from 'react';
import { goldPriceService, GoldPrice } from '@/services/goldPrice';
import { useSupabaseHealth } from './useSupabaseHealth';

export const useGoldPrice = () => {
  const [price, setPrice] = useState<GoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDegraded, isUnhealthy } = useSupabaseHealth();

  useEffect(() => {
    let mounted = true;

    const loadInitialPrice = async () => {
      try {
        // Progressive loading: show cached data first if available
        const cachedPrice = goldPriceService['currentPrice'];
        if (cachedPrice && mounted) {
          setPrice(cachedPrice);
          setLoading(false);
        }

        setError(null);
        const currentPrice = await goldPriceService.getCurrentPrice();
        if (mounted) {
          setPrice(currentPrice);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load gold price';
          // Only show error if we don't have cached data
          if (!price) {
            setError(errorMessage);
          } else {
            console.warn('Using cached gold price due to error:', errorMessage);
          }
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

    // Adjust update frequency based on backend health
    const updateInterval = isUnhealthy ? 120000 : isDegraded ? 60000 : 30000;
    goldPriceService.startRealTimeUpdates(updateInterval);

    // Load initial price
    loadInitialPrice();

    return () => {
      mounted = false;
      unsubscribe();
      goldPriceService.stopRealTimeUpdates();
    };
  }, [isDegraded, isUnhealthy]);

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