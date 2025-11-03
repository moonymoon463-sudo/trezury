import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HyperliquidPositionDB } from '@/types/hyperliquid';

export const useHyperliquidPositions = (address?: string) => {
  const [positions, setPositions] = useState<HyperliquidPositionDB[]>([]);
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
        
        const { data, error: dbError } = await supabase
          .from('hyperliquid_positions')
          .select('*')
          .eq('address', address)
          .eq('status', 'OPEN')
          .order('opened_at', { ascending: false });

        if (dbError) throw dbError;
        
        if (mounted) {
          setPositions((data || []) as HyperliquidPositionDB[]);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load positions');
          console.error('[useHyperliquidPositions] Error:', err);
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
      
      const { data, error: dbError } = await supabase
        .from('hyperliquid_positions')
        .select('*')
        .eq('address', address)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (dbError) throw dbError;
      
      setPositions((data || []) as HyperliquidPositionDB[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh positions');
    } finally {
      setLoading(false);
    }
  };

  return { positions, loading, error, refreshPositions };
};
