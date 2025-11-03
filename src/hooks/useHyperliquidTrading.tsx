import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hyperliquidTradingService } from '@/services/hyperliquidTradingService';
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
    orderRequest: HyperliquidOrderRequest
  ): Promise<HyperliquidOrderResponse> => {
    if (!user || !address) {
      throw new Error('User must be authenticated and address provided');
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

      const response = await hyperliquidTradingService.placeOrder(
        user.id,
        address,
        orderRequest
      );

      if (response.success) {
        toast.success(`${orderRequest.side} order placed successfully`);
        await loadAccountInfo();
      } else {
        toast.error(response.error || 'Failed to place order');
      }

      return response;
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
    placeOrder,
    cancelOrder,
    cancelAllOrders,
    closePosition,
    updateLeverage,
    loadAccountInfo
  };
};
