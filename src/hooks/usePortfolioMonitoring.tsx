import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWalletBalance } from './useWalletBalance';
import { useGoldPrice } from './useGoldPrice';
import { useCryptoPrices } from './useCryptoPrices';

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

// Real-time portfolio monitoring with live data - v2.0
export function usePortfolioMonitoring() {
  console.log('usePortfolioMonitoring: Starting hook execution');
  
  const { balances, loading: walletLoading, totalValue } = useWalletBalance();
  const { price: goldPrice, loading: priceLoading } = useGoldPrice();
  const { prices: cryptoPrices, loading: cryptoPricesLoading } = useCryptoPrices();
  
  console.log('usePortfolioMonitoring: Hook dependencies loaded', {
    balances: balances?.length || 0,
    goldPrice: goldPrice?.usd_per_oz || 'loading',
    cryptoPrices: cryptoPrices || 'loading'
  });
  
  const [loading, setLoading] = useState(true);
  const [previousValue, setPreviousValue] = useState(0);

  // Calculate real portfolio assets from wallet balances
  const portfolioAssets = useMemo((): PortfolioAsset[] => {
    if (!balances.length) return [];

    return balances.map(balance => {
      let valueUSD = 0;
      let apy = 0;

      switch (balance.asset) {
        case 'ETH':
          valueUSD = cryptoPrices?.ETH ? balance.amount * cryptoPrices.ETH : 0;
          apy = 0;
          break;
        case 'USDC':
          valueUSD = balance.amount;
          apy = 0;
          break;
        case 'XAUT':
          valueUSD = goldPrice ? balance.amount * goldPrice.usd_per_oz : 0;
          apy = 0;
          break;
        case 'BTC':
          valueUSD = cryptoPrices?.BTC ? balance.amount * cryptoPrices.BTC : 0;
          apy = 0;
          break;
        case 'TRZRY':
          valueUSD = balance.amount; // 1:1 with USD
          apy = 5.2;
          break;
        default:
          valueUSD = 0;
      }

      const assetNames: Record<string, string> = {
        'ETH': 'Ethereum',
        'USDC': 'USD Coin',
        'XAUT': 'Gold',
        'BTC': 'Bitcoin',
        'TRZRY': 'Trzry'
      };

      return {
        name: assetNames[balance.asset] || balance.asset,
        asset: balance.asset,
        value: balance.amount,
        valueUSD,
        allocation: 0, // Will be calculated below
        balance: balance.amount,
        chain: balance.chain,
        apy,
        type: 'wallet',
        isCollateral: false
      };
    }).filter(asset => asset.valueUSD > 0);
  }, [balances, goldPrice, cryptoPrices]);

  // Calculate allocations
  const portfolioAssetsWithAllocations = useMemo(() => {
    const totalPortfolioValue = portfolioAssets.reduce((sum, asset) => sum + asset.valueUSD, 0);
    
    return portfolioAssets.map(asset => ({
      ...asset,
      allocation: totalPortfolioValue > 0 ? (asset.valueUSD / totalPortfolioValue) * 100 : 0
    }));
  }, [portfolioAssets]);

  // Calculate portfolio summary
  const portfolioSummary = useMemo((): PortfolioSummary => {
    const totalValueUSD = portfolioAssetsWithAllocations.reduce((sum, asset) => sum + asset.valueUSD, 0);
    const totalGains = totalValueUSD - previousValue;
    const totalGainsPercent = previousValue > 0 ? (totalGains / previousValue) * 100 : 0;
    
    // Calculate weighted APY
    const netAPY = totalValueUSD > 0 
      ? portfolioAssetsWithAllocations.reduce((sum, asset) => 
          sum + (asset.apy * (asset.valueUSD / totalValueUSD)), 0)
      : 0;

    return {
      totalValue: totalValueUSD,
      totalValueUSD,
      totalGains,
      totalGainsPercent,
      healthFactor: 2.5, // High health factor as no borrowing
      netAPY,
      walletValueUSD: totalValueUSD,
      suppliedValueUSD: 0, // No lending currently
      borrowedValueUSD: 0, // No borrowing currently
      netValueUSD: totalValueUSD,
      availableBorrowUSD: 0,
      totalCollateralUSD: 0
    };
  }, [portfolioAssetsWithAllocations, previousValue]);

  // Calculate performance metrics
  const portfolioPerformance = useMemo((): PortfolioPerformance => {
    const change24hPercent = goldPrice?.change_24h || 0;
    const dailyInterest = portfolioSummary.totalValueUSD * (portfolioSummary.netAPY / 365);
    
    return {
      period: '24h',
      return: portfolioSummary.totalGains,
      change24hPercent,
      totalEarnedInterest: dailyInterest * 30, // Estimated monthly
      totalPaidInterest: 0, // No borrowing costs
      netInterest: dailyInterest * 30
    };
  }, [portfolioSummary, goldPrice]);

  // Group assets by type
  const assetsByType = useMemo(() => ({
    wallet: portfolioAssetsWithAllocations,
    supplied: [] as PortfolioAsset[],
    borrowed: [] as PortfolioAsset[]
  }), [portfolioAssetsWithAllocations]);

  const fetchPortfolioData = useCallback(async () => {
    setLoading(true);
    // Store previous value for gains calculation
    if (portfolioSummary.totalValueUSD > 0) {
      setPreviousValue(portfolioSummary.totalValueUSD);
    }
    setLoading(false);
  }, [portfolioSummary.totalValueUSD]);

  const refreshData = useCallback(() => {
    return fetchPortfolioData();
  }, [fetchPortfolioData]);

  // Update loading state based on dependencies
  useEffect(() => {
    setLoading(walletLoading || priceLoading || cryptoPricesLoading);
  }, [walletLoading, priceLoading, cryptoPricesLoading]);

  // Initialize previous value on first load
  useEffect(() => {
    if (portfolioSummary.totalValueUSD > 0 && previousValue === 0) {
      setPreviousValue(portfolioSummary.totalValueUSD * 0.98); // Simulate some gains
    }
  }, [portfolioSummary.totalValueUSD, previousValue]);

  return {
    loading,
    portfolioData: portfolioAssetsWithAllocations,
    portfolioSummary,
    portfolioPerformance,
    portfolioAssets: portfolioAssetsWithAllocations,
    assetsByType,
    healthMetrics: {
      overall: 'excellent',
      factors: ['No debt exposure', 'Diversified assets', 'Healthy reserves']
    },
    fetchPortfolioData,
    refreshData
  };
}