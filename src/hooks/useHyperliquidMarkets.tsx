import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HyperliquidMarket } from '@/types/hyperliquid';

export const useHyperliquidMarkets = () => {
  const [markets, setMarkets] = useState<HyperliquidMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadMarkets = async () => {
      try {
        setLoading(true);
        
        const { data, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
          body: {
            operation: 'get_markets'
          }
        });

        if (funcError) throw funcError;
        
        if (mounted) {
          setMarkets(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load markets');
          console.error('[useHyperliquidMarkets] Error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMarkets();

    // Refresh every 30 seconds
    const interval = setInterval(loadMarkets, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const refreshMarkets = async () => {
    try {
      setLoading(true);
      
      const { data, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
        body: {
          operation: 'get_markets'
        }
      });

      if (funcError) throw funcError;
      
      setMarkets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh markets');
    } finally {
      setLoading(false);
    }
  };

  return { markets, loading, error, refreshMarkets };
};
