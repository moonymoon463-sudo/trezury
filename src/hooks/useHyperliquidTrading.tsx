import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hyperliquidTradingService } from '@/services/hyperliquidTradingService';
import { unifiedHyperliquidSigner } from '@/services/unifiedHyperliquidSigner';
import { hyperliquidAssetMapper } from '@/services/hyperliquidAssetMapper';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  HyperliquidOrderRequest,
  HyperliquidOrderResponse,
  HyperliquidAccountState
} from '@/types/hyperliquid';

export const useHyperliquidTrading = (address?: string) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [accountInfo, setAccountInfo] = useState<HyperliquidAccountState | null>(null);
  const [assetMapperReady, setAssetMapperReady] = useState(false);

  // Initialize asset mapper on mount
  useEffect(() => {
    hyperliquidAssetMapper.initialize()
      .then(() => {
        setAssetMapperReady(true);
        console.log('[useHyperliquidTrading] Asset mapper initialized');
      })
      .catch((error) => {
        console.error('[useHyperliquidTrading] Failed to initialize asset mapper:', error);
        toast.error('Failed to load market data');
      });
  }, []);

  const loadAccountInfo = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);
      const info = await hyperliquidTradingService.getAccountInfo(address);
      setAccountInfo(info);
    } catch (error) {
      console.error('[useHyperliquidTrading] Load account error:', error);
      toast.error('Failed to load account info');
    } finally {
      setLoading(false);
    }
  }, [address]);

  const placeOrder = useCallback(async (
    orderRequest: HyperliquidOrderRequest & { password?: string; walletSource?: 'generated' | 'external' }
  ): Promise<HyperliquidOrderResponse> => {
    if (!user || !address) {
      throw new Error('User must be authenticated and address provided');
    }

    if (!assetMapperReady) {
      toast.error('Market data not ready. Please wait...');
      return {
        success: false,
        error: 'Market data not initialized',
        errorCode: 'NOT_READY'
      };
    }

    try {
      setOrderLoading(true);

      // Validate order
      const validation = hyperliquidTradingService.validateOrder(orderRequest);
      if (!validation.valid) {
        toast.error(validation.error);
        return {
          success: false,
          error: validation.error,
          errorCode: 'VALIDATION_ERROR'
        };
      }

      // Get asset index from mapper
      let assetIndex: number;
      try {
        assetIndex = hyperliquidAssetMapper.getAssetIndex(orderRequest.market);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown market';
        toast.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
          errorCode: 'INVALID_MARKET'
        };
      }

      // Format size with correct decimals
      const formattedSize = hyperliquidAssetMapper.formatSize(orderRequest.market, orderRequest.size);
      const formattedPrice = orderRequest.price 
        ? hyperliquidAssetMapper.formatPrice(orderRequest.price)
        : '0';

      // Generate unique client order ID
      const cloid = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      // Determine wallet source
      const walletSource = orderRequest.walletSource || 'generated';

      // 1. Build order action with correct asset index and formatting
      const nonce = Date.now();
      const action = {
        type: 'order',
        orders: [{
          a: assetIndex,
          b: orderRequest.side === 'BUY',
          p: formattedPrice,
          s: formattedSize,
          r: false,
          t: orderRequest.type === 'MARKET' 
            ? { market: {} }
            : { limit: { tif: 'Gtc' } },
          c: cloid
        }],
        grouping: 'na'
      };

      // 2. Sign order on frontend
      const signature = await unifiedHyperliquidSigner.signOrderAction(
        walletSource,
        user.id,
        orderRequest.password || null,
        action,
        nonce
      );

      // 3. Submit signed order to edge function
      const response = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'place_order',
          params: {
            address,
            market: orderRequest.market,
            side: orderRequest.side,
            type: orderRequest.type,
            size: orderRequest.size,
            price: orderRequest.price,
            leverage: orderRequest.leverage,
            action,
            signature,
            nonce,
            cloid
          }
        }
      });

      if (response.data?.status === 'ok' || response.data?.success) {
        toast.success(`${orderRequest.side} order placed successfully`);
        await loadAccountInfo();
        return { success: true };
      } else {
        const errorMsg = response.data?.response?.data?.statuses?.[0]?.error || 
                        response.data?.error || 'Failed to place order';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      console.error('[useHyperliquidTrading] Place order error:', error);
      toast.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        errorCode: 'EXECUTION_ERROR'
      };
    } finally {
      setOrderLoading(false);
    }
  }, [user, address, loadAccountInfo]);

  const cancelOrder = useCallback(async (
    orderId: number,
    market: string
  ): Promise<boolean> => {
    if (!user || !address) {
      toast.error('User must be authenticated');
      return false;
    }

    try {
      setOrderLoading(true);

      const result = await hyperliquidTradingService.cancelOrder(
        user.id,
        address,
        orderId,
        market
      );

      if (result.success) {
        toast.success('Order cancelled successfully');
        await loadAccountInfo();
        return true;
      } else {
        toast.error(result.error || 'Failed to cancel order');
        return false;
      }
    } catch (error) {
      console.error('[useHyperliquidTrading] Cancel order error:', error);
      toast.error('Failed to cancel order');
      return false;
    } finally {
      setOrderLoading(false);
    }
  }, [user, address, loadAccountInfo]);

  const cancelAllOrders = useCallback(async (market?: string): Promise<boolean> => {
    if (!user || !address) {
      toast.error('User must be authenticated');
      return false;
    }

    try {
      setOrderLoading(true);

      const result = await hyperliquidTradingService.cancelAllOrders(
        user.id,
        address,
        market
      );

      if (result.success) {
        toast.success(market ? `All ${market} orders cancelled` : 'All orders cancelled');
        await loadAccountInfo();
        return true;
      } else {
        toast.error(result.error || 'Failed to cancel orders');
        return false;
      }
    } catch (error) {
      console.error('[useHyperliquidTrading] Cancel all orders error:', error);
      toast.error('Failed to cancel orders');
      return false;
    } finally {
      setOrderLoading(false);
    }
  }, [user, address, loadAccountInfo]);

  const closePosition = useCallback(async (
    market: string,
    size?: number
  ): Promise<boolean> => {
    if (!user || !address) {
      toast.error('User must be authenticated');
      return false;
    }

    try {
      setOrderLoading(true);

      const result = await hyperliquidTradingService.closePosition(
        user.id,
        address,
        market,
        size || 0
      );

      if (result.success) {
        toast.success(`Position closed for ${market}`);
        await loadAccountInfo();
        return true;
      } else {
        toast.error(result.error || 'Failed to close position');
        return false;
      }
    } catch (error) {
      console.error('[useHyperliquidTrading] Close position error:', error);
      toast.error('Failed to close position');
      return false;
    } finally {
      setOrderLoading(false);
    }
  }, [user, address, loadAccountInfo]);

  const updateLeverage = useCallback(async (
    market: string,
    leverage: number,
    isCross: boolean = true
  ): Promise<boolean> => {
    if (!user || !address) {
      toast.error('User must be authenticated');
      return false;
    }

    try {
      setLoading(true);

      const result = await hyperliquidTradingService.updateLeverage(
        user.id,
        address,
        market,
        leverage,
        isCross
      );

      if (result.success) {
        toast.success(`Leverage updated to ${leverage}x for ${market}`);
        return true;
      } else {
        toast.error(result.error || 'Failed to update leverage');
        return false;
      }
    } catch (error) {
      console.error('[useHyperliquidTrading] Update leverage error:', error);
      toast.error('Failed to update leverage');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, address]);

  return {
    accountInfo,
    loading,
    orderLoading,
    assetMapperReady,
    placeOrder,
    cancelOrder,
    cancelAllOrders,
    closePosition,
    updateLeverage,
    loadAccountInfo
  };
};
