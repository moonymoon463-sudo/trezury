import { useMemo } from 'react';
import { dydxTradingService } from '@/services/dydxTradingService';
import { dydxRiskManager } from '@/services/dydxRiskManager';
import type { MarginRequirement, PositionSize } from '@/types/dydx-trading';

interface UseLeverageCalculatorProps {
  market: string;
  leverage: number;
  orderSize: number;
  orderPrice?: number;
  side: 'BUY' | 'SELL';
  availableBalance: number;
}

export const useLeverageCalculator = ({
  market,
  leverage,
  orderSize,
  orderPrice,
  side,
  availableBalance
}: UseLeverageCalculatorProps) => {
  
  const maxPositionSize = useMemo(() => {
    if (!orderPrice || leverage <= 0) {
      return {
        maxSize: 0,
        recommendedSize: 0,
        basedOnLeverage: leverage
      };
    }
    
    return dydxTradingService.calculatePositionSize(
      availableBalance,
      orderPrice,
      leverage
    );
  }, [availableBalance, orderPrice, leverage]);

  const liquidationPrice = useMemo(() => {
    if (!orderPrice || leverage <= 0) return 0;
    
    return dydxRiskManager.calculateLiquidationPrice(
      orderPrice,
      leverage,
      side === 'BUY' ? 'LONG' : 'SHORT'
    );
  }, [orderPrice, leverage, side]);

  const marginRequirement = useMemo((): MarginRequirement => {
    if (!orderPrice || orderSize <= 0 || leverage <= 0) {
      return {
        requiredMargin: 0,
        availableMargin: availableBalance,
        sufficient: true,
        liquidationPrice: 0
      };
    }

    const orderValue = orderSize * orderPrice;
    const requiredMargin = orderValue / leverage;
    const sufficient = availableBalance >= requiredMargin;

    return {
      requiredMargin,
      availableMargin: availableBalance,
      sufficient,
      liquidationPrice
    };
  }, [orderSize, orderPrice, leverage, availableBalance, liquidationPrice]);

  const leverageValidation = useMemo(() => {
    return dydxTradingService.validateLeverage(market, leverage);
  }, [market, leverage]);

  const riskLevel = useMemo((): 'low' | 'medium' | 'high' | 'critical' => {
    if (leverage <= 2) return 'low';
    if (leverage <= 5) return 'medium';
    if (leverage <= 10) return 'high';
    return 'critical';
  }, [leverage]);

  const percentToLiquidation = useMemo(() => {
    if (!orderPrice || liquidationPrice <= 0) return 0;
    
    const distance = side === 'BUY'
      ? (orderPrice - liquidationPrice) / orderPrice
      : (liquidationPrice - orderPrice) / orderPrice;
    
    return distance * 100;
  }, [orderPrice, liquidationPrice, side]);

  return {
    maxPositionSize,
    liquidationPrice,
    marginRequirement,
    leverageValidation,
    riskLevel,
    percentToLiquidation
  };
};
