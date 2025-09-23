import { useState } from 'react';

export interface PortfolioAsset {
  name: string;
  asset: string;
  value: number;
  valueUSD: number;
  allocation: number;
  balance: number;
  chain?: string;
  apy?: number;
  type?: string;
  isCollateral?: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  totalValueUSD: number;
  totalGains: number;
  totalGainsPercent: number;
  healthFactor?: number;
  netAPY?: number;
  walletValueUSD?: number;
  suppliedValueUSD?: number;
  borrowedValueUSD?: number;
  netValueUSD?: number;
  availableBorrowUSD?: number;
  totalCollateralUSD?: number;
}

export interface PortfolioPerformance {
  period: string;
  return: number;
  change24hPercent?: number;
  totalEarnedInterest?: number;
  totalPaidInterest?: number;
  netInterest?: number;
}

// Stub hook for portfolio monitoring (lending functionality removed)
export function usePortfolioMonitoring() {
  const [loading] = useState(false);
  
  return {
    loading,
    portfolioData: [],
    portfolioSummary: {
      totalValue: 0,
      totalValueUSD: 0,
      totalGains: 0,
      totalGainsPercent: 0,
      healthFactor: 1.5,
      netAPY: 0,
      walletValueUSD: 0,
      suppliedValueUSD: 0,
      borrowedValueUSD: 0,
      netValueUSD: 0,
      availableBorrowUSD: 0,
      totalCollateralUSD: 0
    } as PortfolioSummary,
    portfolioPerformance: {
      period: '24h',
      return: 0,
      change24hPercent: 0,
      totalEarnedInterest: 0,
      totalPaidInterest: 0,
      netInterest: 0
    } as PortfolioPerformance,
    portfolioAssets: [] as PortfolioAsset[],
    assetsByType: {
      wallet: [] as PortfolioAsset[],
      supplied: [] as PortfolioAsset[],
      borrowed: [] as PortfolioAsset[]
    },
    healthMetrics: {
      overall: 'good',
      factors: []
    },
    fetchPortfolioData: () => Promise.resolve(),
    refreshData: () => Promise.resolve()
  };
}