import { useState, useEffect } from 'react';
import { dydxMarketService } from '@/services/dydxMarketService';

export interface MarketRules {
  tickSize: number;
  stepSize: number;
  minOrderSize: number;
  minNotional: number;
  maxLeverage: number;
  makerFeeRate: number;
  takerFeeRate: number;
}

export const useMarketRules = (market: string | null) => {
  const [rules, setRules] = useState<MarketRules | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!market) {
      setRules(null);
      return;
    }

    const fetchRules = async () => {
      setLoading(true);
      setError(null);

      try {
        const marketRules = await dydxMarketService.getMarketRules(market);
        setRules(marketRules);
      } catch (err) {
        console.error('[useMarketRules] Error fetching rules:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch market rules');
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, [market]);

  const validateOrderSize = (size: number, price: number): { valid: boolean; error?: string } => {
    if (!rules) {
      return { valid: false, error: 'Market rules not loaded' };
    }

    return dydxMarketService.validateOrderSize(size, price, rules);
  };

  const calculateFees = (
    size: number,
    price: number,
    orderType: 'market' | 'limit'
  ): { makerFee: number; takerFee: number; totalFee: number } => {
    if (!rules) {
      return { makerFee: 0, takerFee: 0, totalFee: 0 };
    }

    const notional = size * price;
    const feeRate = orderType === 'market' ? rules.takerFeeRate : rules.makerFeeRate;
    const fee = notional * feeRate;

    return {
      makerFee: orderType === 'limit' ? fee : 0,
      takerFee: orderType === 'market' ? fee : 0,
      totalFee: fee,
    };
  };

  return {
    rules,
    loading,
    error,
    validateOrderSize,
    calculateFees,
  };
};
