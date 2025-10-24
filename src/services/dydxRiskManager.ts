import type { DydxPosition } from '@/types/dydx';
import type { OrderRequest, PositionRisk } from '@/types/dydx-trading';

interface RiskLimits {
  maxLeverageByMarket: Record<string, number>;
  maxPositionSize: Record<string, number>;
  maxPortfolioMarginUsage: number;
  liquidationBuffer: number;
}

class DydxRiskManager {
  private limits: RiskLimits = {
    maxLeverageByMarket: {
      'BTC-USD': 20,
      'ETH-USD': 20,
      'SOL-USD': 20,
      'default': 10
    },
    maxPositionSize: {
      'BTC-USD': 10, // BTC
      'ETH-USD': 100, // ETH
      'SOL-USD': 1000, // SOL
      'default': 1000
    },
    maxPortfolioMarginUsage: 0.8, // 80% max margin usage
    liquidationBuffer: 0.15 // 15% buffer from liquidation
  };

  validateOrder(
    order: OrderRequest,
    accountEquity: number,
    freeCollateral: number,
    currentMarginUsage: number
  ): { valid: boolean; reason?: string } {
    // Check leverage limits
    const maxLeverage = this.getMaxLeverage(order.market);
    if (order.leverage > maxLeverage) {
      return {
        valid: false,
        reason: `Maximum leverage for ${order.market} is ${maxLeverage}x`
      };
    }

    // Check position size limits
    const maxSize = this.getMaxPositionSize(order.market);
    if (order.size > maxSize) {
      return {
        valid: false,
        reason: `Maximum position size for ${order.market} is ${maxSize}`
      };
    }

    // Check margin usage
    if (currentMarginUsage >= this.limits.maxPortfolioMarginUsage) {
      return {
        valid: false,
        reason: `Portfolio margin usage (${(currentMarginUsage * 100).toFixed(1)}%) exceeds maximum allowed (${(this.limits.maxPortfolioMarginUsage * 100).toFixed(1)}%)`
      };
    }

    // Check sufficient collateral
    const requiredMargin = this.calculateRequiredMargin(order);
    if (freeCollateral < requiredMargin) {
      return {
        valid: false,
        reason: `Insufficient collateral. Required: $${requiredMargin.toFixed(2)}, Available: $${freeCollateral.toFixed(2)}`
      };
    }

    return { valid: true };
  }

  assessPositionRisk(
    position: DydxPosition,
    currentPrice: number,
    maintenanceMargin: number = 0.03
  ): PositionRisk {
    const liquidationPrice = this.calculateLiquidationPrice(
      position.entry_price,
      position.leverage,
      position.side,
      maintenanceMargin
    );

    const distanceToLiquidation = position.side === 'LONG'
      ? (currentPrice - liquidationPrice) / currentPrice
      : (liquidationPrice - currentPrice) / currentPrice;

    const marginRatio = Math.abs(position.unrealized_pnl) / (position.size * position.entry_price / position.leverage);

    let riskLevel: PositionRisk['riskLevel'];
    let recommendedAction: string | undefined;

    if (distanceToLiquidation < 0.05) {
      riskLevel = 'critical';
      recommendedAction = 'Close position immediately or add margin';
    } else if (distanceToLiquidation < 0.15) {
      riskLevel = 'high';
      recommendedAction = 'Consider reducing position size or adding margin';
    } else if (distanceToLiquidation < 0.3) {
      riskLevel = 'medium';
      recommendedAction = 'Monitor closely';
    } else {
      riskLevel = 'low';
    }

    return {
      distanceToLiquidation,
      marginRatio,
      riskLevel,
      recommendedAction
    };
  }

  calculateRequiredMargin(order: OrderRequest, price?: number): number {
    const orderValue = order.size * (order.price || price || 0);
    return orderValue / order.leverage;
  }

  calculateLiquidationPrice(
    entryPrice: number,
    leverage: number,
    side: 'LONG' | 'SHORT',
    maintenanceMargin: number = 0.03
  ): number {
    if (side === 'LONG') {
      return entryPrice * (1 - (1 / leverage - maintenanceMargin));
    } else {
      return entryPrice * (1 + (1 / leverage - maintenanceMargin));
    }
  }

  shouldTriggerLiquidationAlert(
    position: DydxPosition,
    currentPrice: number
  ): boolean {
    const risk = this.assessPositionRisk(position, currentPrice);
    return risk.distanceToLiquidation < this.limits.liquidationBuffer;
  }

  getRecommendedLeverage(market: string, riskTolerance: 'low' | 'medium' | 'high'): number {
    const maxLeverage = this.getMaxLeverage(market);
    
    const multipliers = {
      low: 0.3,
      medium: 0.5,
      high: 0.8
    };

    return Math.floor(maxLeverage * multipliers[riskTolerance]);
  }

  private getMaxLeverage(market: string): number {
    return this.limits.maxLeverageByMarket[market] || this.limits.maxLeverageByMarket.default;
  }

  private getMaxPositionSize(market: string): number {
    return this.limits.maxPositionSize[market] || this.limits.maxPositionSize.default;
  }
}

export const dydxRiskManager = new DydxRiskManager();
