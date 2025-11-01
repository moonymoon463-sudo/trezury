/**
 * React hook for 01 Protocol trading operations
 */

import { useState } from 'react';
import { zoTradingService, PlaceOrderParams, ClosePositionParams, CancelOrderParams, TradeResult } from '@/exchanges/01protocol/tradingService';
import { useToast } from '@/hooks/use-toast';

export const use01Trading = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * Place an order
   */
  const placeOrder = async (
    params: PlaceOrderParams,
    password: string
  ): Promise<TradeResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await zoTradingService.placeOrder(params, password);

      if (result.ok) {
        toast({
          title: 'Order Placed',
          description: `${params.side.toUpperCase()} ${params.size} ${params.market}`,
        });
      } else {
        setError(result.message);
        toast({
          title: 'Order Failed',
          description: result.message,
          variant: 'destructive',
        });
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast({
        title: 'Order Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      return {
        ok: false,
        message: errorMsg,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Close a position
   */
  const closePosition = async (
    params: ClosePositionParams,
    password: string
  ): Promise<TradeResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await zoTradingService.closePosition(params, password);

      if (result.ok) {
        toast({
          title: 'Position Closed',
          description: `Closed ${params.market} position`,
        });
      } else {
        setError(result.message);
        toast({
          title: 'Close Failed',
          description: result.message,
          variant: 'destructive',
        });
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast({
        title: 'Close Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      return {
        ok: false,
        message: errorMsg,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancel an order
   */
  const cancelOrder = async (
    params: CancelOrderParams,
    password: string
  ): Promise<TradeResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await zoTradingService.cancelOrder(params, password);

      if (result.ok) {
        toast({
          title: 'Order Cancelled',
          description: `Cancelled order ${params.orderId}`,
        });
      } else {
        setError(result.message);
        toast({
          title: 'Cancel Failed',
          description: result.message,
          variant: 'destructive',
        });
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast({
        title: 'Cancel Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      return {
        ok: false,
        message: errorMsg,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch positions
   */
  const fetchPositions = async (password: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await zoTradingService.getPositions(password);

      if (!result.ok) {
        setError(result.message);
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return {
        ok: false,
        message: errorMsg,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    placeOrder,
    closePosition,
    cancelOrder,
    fetchPositions,
    loading,
    error,
  };
};
