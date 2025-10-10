import { useState, useEffect } from 'react';
import { cryptoPriceService, CryptoPrices } from '@/services/cryptoPriceService';

export const useCryptoPrices = () => {
  const [prices, setPrices] = useState<CryptoPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadInitialPrices = async () => {
      try {
        // Show cached prices first if available
        const cachedPrices = cryptoPriceService['currentPrices'];
        if (cachedPrices && mounted) {
          setPrices(cachedPrices);
          setLoading(false);
        }

        setError(null);
        const currentPrices = await cryptoPriceService.getCurrentPrices();
        if (mounted) {
          setPrices(currentPrices);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load crypto prices';
          if (!prices) {
            setError(errorMessage);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Subscribe to real-time updates
    const unsubscribe = cryptoPriceService.subscribe((newPrices) => {
      if (mounted) {
        setPrices(newPrices);
        setLoading(false);
        setError(null);
      }
    });

    // Start real-time updates (30 seconds)
    cryptoPriceService.startRealTimeUpdates(30000);

    // Load initial prices
    loadInitialPrices();

    return () => {
      mounted = false;
      unsubscribe();
      cryptoPriceService.stopRealTimeUpdates();
    };
  }, []);

  const refreshPrices = async () => {
    try {
      setLoading(true);
      setError(null);
      await cryptoPriceService.getCurrentPrices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh prices');
    } finally {
      setLoading(false);
    }
  };

  return {
    prices,
    loading,
    error,
    refreshPrices
  };
};
