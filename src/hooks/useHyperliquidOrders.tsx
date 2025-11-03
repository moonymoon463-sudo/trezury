import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HyperliquidOrderDB } from '@/types/hyperliquid';
import { hyperliquidTradingService } from '@/services/hyperliquidTradingService';
import { useAuth } from './useAuth';

export const useHyperliquidOrders = (address?: string) => {
  const [orders, setOrders] = useState<HyperliquidOrderDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadOrders = useCallback(async () => {
    if (!address || !user?.id) {
      setOrders([]);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch from database
      const { data, error: dbError } = await supabase
        .from('hyperliquid_orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('address', address)
        .order('created_at', { ascending: false })
        .limit(100);

      if (dbError) throw dbError;
      
      setOrders((data || []) as HyperliquidOrderDB[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      console.error('[useHyperliquidOrders] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [address, user?.id]);

  useEffect(() => {
    loadOrders();

    // Refresh orders every 10 seconds
    const interval = setInterval(loadOrders, 10000);

    return () => clearInterval(interval);
  }, [loadOrders]);

  const cancelOrder = async (orderId: number, market: string): Promise<boolean> => {
    if (!address || !user?.id) return false;

    try {
      const response = await hyperliquidTradingService.cancelOrder(
        user.id,
        address,
        orderId,
        market
      );

      if (response.success) {
        await loadOrders();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useHyperliquidOrders] Cancel error:', err);
      return false;
    }
  };

  const cancelAllOrders = async (market?: string): Promise<boolean> => {
    if (!address || !user?.id) return false;

    try {
      const response = await hyperliquidTradingService.cancelAllOrders(
        user.id,
        address,
        market
      );

      if (response.success) {
        await loadOrders();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useHyperliquidOrders] Cancel all error:', err);
      return false;
    }
  };

  return {
    orders,
    loading,
    error,
    refreshOrders: loadOrders,
    cancelOrder,
    cancelAllOrders
  };
};
