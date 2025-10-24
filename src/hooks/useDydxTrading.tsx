import { useState, useCallback } from 'react';
import { dydxTradingService } from '@/services/dydxTradingService';
import { dydxRiskManager } from '@/services/dydxRiskManager';
import type { DydxAccountInfo, OrderRequest, OrderResponse } from '@/types/dydx-trading';
import { useToast } from '@/hooks/use-toast';

export const useDydxTrading = (walletAddress?: string) => {
  const [accountInfo, setAccountInfo] = useState<DydxAccountInfo | null>(null);
  const [leverage, setLeverage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const { toast } = useToast();

  const loadAccountInfo = useCallback(async () => {
    if (!walletAddress) return;

    try {
      setLoading(true);
      const info = await dydxTradingService.getAccountInfo(walletAddress);
      setAccountInfo(info);
    } catch (error) {
      console.error('[useDydxTrading] Failed to load account:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load account',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  }, [walletAddress, toast]);

  const placeOrder = useCallback(async (order: OrderRequest): Promise<OrderResponse> => {
    if (!walletAddress || !accountInfo) {
      return {
        success: false,
        error: 'Wallet not connected or account info not loaded',
        errorCode: 'NO_WALLET'
      };
    }

    // Validate order with risk manager
    const validation = dydxRiskManager.validateOrder(
      order,
      accountInfo.equity,
      accountInfo.freeCollateral,
      accountInfo.marginUsage
    );

    if (!validation.valid) {
      toast({
        variant: 'destructive',
        title: 'Order Validation Failed',
        description: validation.reason
      });
      return {
        success: false,
        error: validation.reason,
        errorCode: 'VALIDATION_FAILED'
      };
    }

    try {
      setOrderLoading(true);
      
      const response = order.type === 'MARKET'
        ? await dydxTradingService.placeMarketOrder(order)
        : await dydxTradingService.placeLimitOrder(order);

      if (response.success) {
        toast({
          title: 'Order Placed',
          description: `${order.side} ${order.size} ${order.market} at ${order.leverage}x leverage`
        });
        
        // Reload account info
        await loadAccountInfo();
      } else {
        toast({
          variant: 'destructive',
          title: 'Order Failed',
          description: response.error
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: 'Order Error',
        description: errorMessage
      });
      return {
        success: false,
        error: errorMessage,
        errorCode: 'EXCEPTION'
      };
    } finally {
      setOrderLoading(false);
    }
  }, [walletAddress, accountInfo, toast, loadAccountInfo]);

  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const success = await dydxTradingService.cancelOrder(orderId);
      
      if (success) {
        toast({
          title: 'Order Cancelled',
          description: 'Your order has been cancelled successfully'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Cancellation Failed',
          description: 'Unable to cancel order'
        });
      }

      return success;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }, [toast]);

  const updateLeverage = useCallback((newLeverage: number, market: string) => {
    const validation = dydxTradingService.validateLeverage(market, newLeverage);
    
    if (!validation.valid) {
      toast({
        variant: 'destructive',
        title: 'Invalid Leverage',
        description: validation.reason
      });
      return false;
    }

    setLeverage(newLeverage);
    return true;
  }, [toast]);

  return {
    accountInfo,
    leverage,
    loading,
    orderLoading,
    placeOrder,
    cancelOrder,
    updateLeverage,
    loadAccountInfo
  };
};
