import { useState, useEffect } from 'react';
import { dydxMarketService } from '@/services/dydxMarketService';
import type { DydxPosition } from '@/types/dydx';

export const useDydxPositions = (address?: string) => {
  const [positions, setPositions] = useState<DydxPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setPositions([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadPositions = async () => {
      try {
        setLoading(true);
        const data = await dydxMarketService.getUserPositions(address);
        if (mounted) {
          setPositions(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load positions');
          console.error('[useDydxPositions] Error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPositions();

    // Refresh positions every 30 seconds
    const interval = setInterval(loadPositions, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [address]);

  const refreshPositions = async () => {
    if (!address) return;

    try {
      setLoading(true);
      const data = await dydxMarketService.getUserPositions(address);
      setPositions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh positions');
    } finally {
      setLoading(false);
    }
  };

  return { positions, loading, error, refreshPositions };
};
