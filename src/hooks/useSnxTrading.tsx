/**
 * Hook for Synthetix trading operations
 */

import { useState } from 'react';
import { snxTradingService } from '@/services/snxTradingService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { SnxAccount, SnxTradeRequest, SnxTradeResponse } from '@/types/snx';

export const useSnxTrading = (chainId: number = 8453) => {
  const { user } = useAuth();
  const [accountInfo, setAccountInfo] = useState<SnxAccount | null>(null);
  const [leverage, setLeverage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);

  const loadAccountInfo = async (accountId: bigint) => {
    if (!accountId) return;

    try {
      setLoading(true);
      const info = await snxTradingService.getAccountInfo(accountId, chainId);
      setAccountInfo(info);
    } catch (error) {
      console.error('[useSnxTrading] Error loading account:', error);
      toast.error('Failed to load trading account');
    } finally {
      setLoading(false);
    }
  };

  const placeOrder = async (
    request: SnxTradeRequest,
    walletSource: 'internal' | 'external',
    password?: string
  ): Promise<SnxTradeResponse> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      setOrderLoading(true);

      // Validate leverage
      const leverageValidation = await snxTradingService.validateLeverage(
        request.marketKey,
        request.leverage,
        chainId
      );

      if (!leverageValidation.valid) {
        toast.error(leverageValidation.reason || 'Invalid leverage');
        return { success: false, error: leverageValidation.reason };
      }

      const result = await snxTradingService.placeTrade(
        request,
        walletSource,
        chainId,
        password
      );

      if (result.success) {
        toast.success('Order placed successfully');
        // Reload account info
        if (accountInfo) {
          await loadAccountInfo(accountInfo.accountId);
        }
      } else {
        toast.error(result.error || 'Order failed');
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Order failed';
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setOrderLoading(false);
    }
  };

  const updateLeverage = (newLeverage: number) => {
    if (newLeverage < 1 || newLeverage > 50) {
      toast.error('Leverage must be between 1× and 50×');
      return;
    }
    setLeverage(newLeverage);
  };

  return {
    accountInfo,
    leverage,
    loading,
    orderLoading,
    placeOrder,
    updateLeverage,
    loadAccountInfo
  };
};
