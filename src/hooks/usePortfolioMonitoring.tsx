import { useState, useEffect, useMemo } from 'react';
import { useWalletBalance } from './useWalletBalance';
import { useLendingOperations } from './useLendingOperations';
import { useGoldPrice } from './useGoldPrice';

export interface PortfolioAsset {
  asset: string;
  chain: string;
  balance: number;
  valueUSD: number;
  type: 'wallet' | 'supplied' | 'borrowed';
  isCollateral?: boolean;
  apy?: number;
}

export interface PortfolioSummary {
  totalValueUSD: number;
  walletValueUSD: number;
  suppliedValueUSD: number;
  borrowedValueUSD: number;
  netValueUSD: number;
  healthFactor: number;
  netAPY: number;
  availableBorrowUSD: number;
  totalCollateralUSD: number;
}

export interface PortfolioPerformance {
  change24h: number;
  change24hPercent: number;
  totalEarnedInterest: number;
  totalPaidInterest: number;
  netInterest: number;
}

export const usePortfolioMonitoring = () => {
  const { balances: walletBalances, loading: walletLoading } = useWalletBalance();
  const { 
    userPositions, 
    healthFactor, 
    loading: lendingLoading,
    poolAssets 
  } = useLendingOperations();
  const { price: goldPrice } = useGoldPrice();

  // Transform userPositions to match old format for compatibility
  const userSupplies = userPositions.filter(pos => pos.suppliedAmount > 0).map(pos => ({
    asset: pos.asset,
    chain: pos.chain,
    supplied_amount_dec: pos.suppliedAmount,
    accrued_interest_dec: 0,
    used_as_collateral: true
  }));

  const userBorrows = userPositions.filter(pos => pos.borrowedAmount > 0).map(pos => ({
    asset: pos.asset,
    chain: pos.chain,
    borrowed_amount_dec: pos.borrowedAmount,
    accrued_interest_dec: 0
  }));

  const poolReserves = poolAssets.map(asset => ({
    asset: asset.asset,
    chain: asset.chain,
    supply_rate: asset.supplyApy,
    borrow_rate_variable: asset.borrowApy
  }));

  const [portfolioHistory, setPortfolioHistory] = useState<Array<{
    timestamp: Date;
    totalValue: number;
  }>>([]);

  // Asset prices (simplified - in real app would fetch from price oracle)
  const assetPrices = useMemo(() => ({
    USDC: 1.0,
    USDT: 1.0,
    DAI: 1.0,
    XAUT: goldPrice?.usd_per_oz || 2000, // XAUT tracks gold price
    AURU: 0.5, // Mock AURU price
  }), [goldPrice]);

  // Calculate portfolio assets
  const portfolioAssets = useMemo((): PortfolioAsset[] => {
    const assets: PortfolioAsset[] = [];

    // Wallet balances
    walletBalances.forEach(balance => {
      const price = assetPrices[balance.asset as keyof typeof assetPrices] || 0;
      assets.push({
        asset: balance.asset,
        chain: balance.chain,
        balance: Number(balance.amount),
        valueUSD: Number(balance.amount) * price,
        type: 'wallet'
      });
    });

    // Supplied assets (earning interest)
    userSupplies.forEach(supply => {
      const price = assetPrices[supply.asset as keyof typeof assetPrices] || 0;
      const pool = poolReserves.find(p => p.asset === supply.asset && p.chain === supply.chain);
      
      assets.push({
        asset: supply.asset,
        chain: supply.chain,
        balance: Number(supply.supplied_amount_dec) + Number(supply.accrued_interest_dec),
        valueUSD: (Number(supply.supplied_amount_dec) + Number(supply.accrued_interest_dec)) * price,
        type: 'supplied',
        isCollateral: supply.used_as_collateral,
        apy: pool?.supply_rate || 0
      });
    });

    // Borrowed assets (owing interest)
    userBorrows.forEach(borrow => {
      const price = assetPrices[borrow.asset as keyof typeof assetPrices] || 0;
      const pool = poolReserves.find(p => p.asset === borrow.asset && p.chain === borrow.chain);
      
      assets.push({
        asset: borrow.asset,
        chain: borrow.chain,
        balance: -(Number(borrow.borrowed_amount_dec) + Number(borrow.accrued_interest_dec)),
        valueUSD: -(Number(borrow.borrowed_amount_dec) + Number(borrow.accrued_interest_dec)) * price,
        type: 'borrowed',
        apy: pool?.borrow_rate_variable || 0
      });
    });

    return assets;
  }, [walletBalances, userSupplies, userBorrows, assetPrices, poolReserves]);

  // Calculate portfolio summary
  const portfolioSummary = useMemo((): PortfolioSummary => {
    const walletValueUSD = portfolioAssets
      .filter(a => a.type === 'wallet')
      .reduce((sum, a) => sum + a.valueUSD, 0);

    const suppliedValueUSD = portfolioAssets
      .filter(a => a.type === 'supplied')
      .reduce((sum, a) => sum + a.valueUSD, 0);

    const borrowedValueUSD = Math.abs(portfolioAssets
      .filter(a => a.type === 'borrowed')
      .reduce((sum, a) => sum + a.valueUSD, 0));

    const totalCollateralUSD = portfolioAssets
      .filter(a => a.type === 'supplied' && a.isCollateral)
      .reduce((sum, a) => sum + a.valueUSD, 0);

    const totalValueUSD = walletValueUSD + suppliedValueUSD;
    const netValueUSD = totalValueUSD - borrowedValueUSD;

    // Calculate weighted average APY
    const suppliedAssetsWithAPY = portfolioAssets.filter(a => a.type === 'supplied' && a.apy);
    const totalSuppliedValue = suppliedAssetsWithAPY.reduce((sum, a) => sum + a.valueUSD, 0);
    const weightedSupplyAPY = totalSuppliedValue > 0 
      ? suppliedAssetsWithAPY.reduce((sum, a) => sum + (a.apy! * a.valueUSD), 0) / totalSuppliedValue
      : 0;

    const borrowedAssetsWithAPY = portfolioAssets.filter(a => a.type === 'borrowed' && a.apy);
    const totalBorrowedValue = borrowedAssetsWithAPY.reduce((sum, a) => sum + Math.abs(a.valueUSD), 0);
    const weightedBorrowAPY = totalBorrowedValue > 0 
      ? borrowedAssetsWithAPY.reduce((sum, a) => sum + (a.apy! * Math.abs(a.valueUSD)), 0) / totalBorrowedValue
      : 0;

    const netAPY = totalSuppliedValue > 0 
      ? (weightedSupplyAPY * suppliedValueUSD - weightedBorrowAPY * borrowedValueUSD) / totalSuppliedValue
      : 0;

    // Calculate available borrow capacity (simplified)
    const maxLTV = 0.8; // Assume 80% max LTV
    const maxBorrowUSD = totalCollateralUSD * maxLTV;
    const availableBorrowUSD = Math.max(0, maxBorrowUSD - borrowedValueUSD);

    return {
      totalValueUSD,
      walletValueUSD,
      suppliedValueUSD,
      borrowedValueUSD,
      netValueUSD,
      healthFactor: healthFactor,
      netAPY,
      availableBorrowUSD,
      totalCollateralUSD
    };
  }, [portfolioAssets, healthFactor]);

  // Calculate performance metrics
  const portfolioPerformance = useMemo((): PortfolioPerformance => {
    // Mock data - in real app would track historical data
    const change24h = portfolioSummary.totalValueUSD * 0.02; // 2% daily change
    const change24hPercent = 2.0;
    
    // Calculate estimated interest earned/paid
    const totalEarnedInterest = userSupplies.reduce((sum, supply) => 
      sum + Number(supply.accrued_interest_dec), 0);
    
    const totalPaidInterest = userBorrows.reduce((sum, borrow) => 
      sum + Number(borrow.accrued_interest_dec), 0);

    const netInterest = totalEarnedInterest - totalPaidInterest;

    return {
      change24h,
      change24hPercent,
      totalEarnedInterest,
      totalPaidInterest,
      netInterest
    };
  }, [portfolioSummary.totalValueUSD, userSupplies, userBorrows]);

  // Update portfolio history periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPortfolioHistory(prev => {
        const newEntry = {
          timestamp: new Date(),
          totalValue: portfolioSummary.totalValueUSD
        };
        
        // Keep last 24 hours of data (hourly snapshots)
        const filtered = prev.filter(entry => 
          Date.now() - entry.timestamp.getTime() < 24 * 60 * 60 * 1000
        );
        
        return [...filtered, newEntry].slice(-24);
      });
    }, 60 * 60 * 1000); // Update every hour

    return () => clearInterval(interval);
  }, [portfolioSummary.totalValueUSD]);

  // Group assets by type for easier display
  const assetsByType = useMemo(() => ({
    wallet: portfolioAssets.filter(a => a.type === 'wallet'),
    supplied: portfolioAssets.filter(a => a.type === 'supplied'),
    borrowed: portfolioAssets.filter(a => a.type === 'borrowed')
  }), [portfolioAssets]);

  return {
    portfolioAssets,
    portfolioSummary,
    portfolioPerformance,
    portfolioHistory,
    assetsByType,
    loading: walletLoading || lendingLoading,
    assetPrices
  };
};
