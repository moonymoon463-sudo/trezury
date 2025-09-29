import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useOptimizedWalletBalance } from './useOptimizedWalletBalance';
import { supabase } from '@/integrations/supabase/client';

export interface HistoricalData {
  date: string;
  portfolioValue: number;
  goldPrice: number;
  profit: number;
  allocation: {
    gold: number;
    usdc: number;
  };
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  bestMonth: number;
  worstMonth: number;
  winRate: number;
}

export interface AdvancedAnalyticsData {
  historicalData: HistoricalData[];
  performanceMetrics: PerformanceMetrics;
  riskMetrics: {
    var95: number;
    var99: number;
    beta: number;
    correlation: number;
  };
  benchmark: {
    name: string;
    return: number;
    outperformance: number;
  };
}

export function useAdvancedAnalytics() {
  const { user } = useAuth();
  const { balances, totalValue } = useOptimizedWalletBalance();
  
  const [analyticsData, setAnalyticsData] = useState<AdvancedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | '90d' | '1y'>('30d');

  const generateAnalytics = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Get historical portfolio data
      const { data: balanceHistory, error: balanceError } = await supabase
        .from('balance_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .gte('snapshot_at', getTimeframeStartDate(timeframe))
        .order('snapshot_at', { ascending: true });

      if (balanceError) throw balanceError;

      // Get historical gold prices
      const { data: goldPriceHistory, error: priceError } = await supabase
        .from('gold_prices')
        .select('*')
        .gte('timestamp', getTimeframeStartDate(timeframe))
        .order('timestamp', { ascending: true });

      if (priceError) throw priceError;

      // Process and combine data
      const processedData = processHistoricalData(balanceHistory || [], goldPriceHistory || []);
      const metrics = calculatePerformanceMetrics(processedData);
      const riskMetrics = calculateRiskMetrics(processedData);
      const benchmark = calculateBenchmarkComparison(processedData, goldPriceHistory || []);

      setAnalyticsData({
        historicalData: processedData,
        performanceMetrics: metrics,
        riskMetrics,
        benchmark
      });

    } catch (err) {
      console.error('Advanced analytics failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate analytics');
    } finally {
      setLoading(false);
    }
  }, [user?.id, timeframe]);

  const refreshAnalytics = useCallback(() => {
    return generateAnalytics();
  }, [generateAnalytics]);

  const updateTimeframe = useCallback((newTimeframe: '24h' | '7d' | '30d' | '90d' | '1y') => {
    setTimeframe(newTimeframe);
  }, []);

  useEffect(() => {
    generateAnalytics();
  }, [generateAnalytics]);

  return {
    analyticsData,
    loading,
    error,
    timeframe,
    refreshAnalytics,
    updateTimeframe
  };
}

// Helper functions
function getTimeframeStartDate(timeframe: string): string {
  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;
  
  switch (timeframe) {
    case '24h':
      return new Date(now.getTime() - msInDay).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * msInDay).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * msInDay).toISOString();
    case '90d':
      return new Date(now.getTime() - 90 * msInDay).toISOString();
    case '1y':
      return new Date(now.getTime() - 365 * msInDay).toISOString();
    default:
      return new Date(now.getTime() - 30 * msInDay).toISOString();
  }
}

function processHistoricalData(balanceHistory: any[], goldPriceHistory: any[]): HistoricalData[] {
  // Group balance data by date and calculate portfolio values
  const dataMap = new Map<string, any>();
  
  // Process balance snapshots
  balanceHistory.forEach(snapshot => {
    const dateKey = snapshot.snapshot_at.split('T')[0];
    if (!dataMap.has(dateKey)) {
      dataMap.set(dateKey, {
        date: dateKey,
        balances: {},
        goldPrice: 0
      });
    }
    
    const dayData = dataMap.get(dateKey);
    if (!dayData.balances[snapshot.asset]) {
      dayData.balances[snapshot.asset] = 0;
    }
    dayData.balances[snapshot.asset] += snapshot.amount;
  });

  // Add gold prices
  goldPriceHistory.forEach(price => {
    const dateKey = price.timestamp.split('T')[0];
    if (dataMap.has(dateKey)) {
      dataMap.get(dateKey).goldPrice = price.usd_per_oz;
    }
  });

  // Convert to historical data format
  const historicalData: HistoricalData[] = [];
  let previousValue = 0;

  Array.from(dataMap.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach(dayData => {
      const usdcBalance = dayData.balances.USDC || 0;
      const xautBalance = dayData.balances.XAUT || 0;
      const goldPrice = dayData.goldPrice || 2000; // Default fallback
      
      const portfolioValue = usdcBalance + (xautBalance * goldPrice);
      const profit = portfolioValue - previousValue;
      
      if (previousValue === 0) {
        previousValue = portfolioValue;
      }

      const totalBalance = usdcBalance + xautBalance;
      const goldAllocation = totalBalance > 0 ? (xautBalance / totalBalance) * 100 : 0;
      const usdcAllocation = totalBalance > 0 ? (usdcBalance / totalBalance) * 100 : 0;

      historicalData.push({
        date: dayData.date,
        portfolioValue,
        goldPrice,
        profit,
        allocation: {
          gold: goldAllocation,
          usdc: usdcAllocation
        }
      });

      previousValue = portfolioValue;
    });

  return historicalData;
}

function calculatePerformanceMetrics(data: HistoricalData[]): PerformanceMetrics {
  if (data.length < 2) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      bestMonth: 0,
      worstMonth: 0,
      winRate: 0
    };
  }

  const returns = [];
  const values = data.map(d => d.portfolioValue);
  const initialValue = values[0];
  const finalValue = values[values.length - 1];

  // Calculate daily returns
  for (let i = 1; i < values.length; i++) {
    const dailyReturn = (values[i] - values[i - 1]) / values[i - 1];
    returns.push(dailyReturn);
  }

  // Calculate metrics
  const totalReturn = ((finalValue - initialValue) / initialValue) * 100;
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const annualizedReturn = Math.pow(1 + avgReturn, 252) - 1; // 252 trading days
  
  // Volatility (standard deviation of returns)
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized

  // Sharpe ratio (assuming 3% risk-free rate)
  const riskFreeRate = 0.03;
  const sharpeRatio = (annualizedReturn - riskFreeRate) / (volatility / 100);

  // Max drawdown
  let maxDrawdown = 0;
  let peak = values[0];
  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Best and worst month (approximation)
  const monthlyReturns = returns.filter((_, i) => i % 30 === 0); // Approximate monthly
  const bestMonth = Math.max(...monthlyReturns) * 100;
  const worstMonth = Math.min(...monthlyReturns) * 100;

  // Win rate
  const positiveReturns = returns.filter(r => r > 0).length;
  const winRate = (positiveReturns / returns.length) * 100;

  return {
    totalReturn,
    annualizedReturn: annualizedReturn * 100,
    volatility,
    sharpeRatio,
    maxDrawdown: maxDrawdown * 100,
    bestMonth,
    worstMonth,
    winRate
  };
}

function calculateRiskMetrics(data: HistoricalData[]) {
  // Simplified risk metrics calculation
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    const dailyReturn = (data[i].portfolioValue - data[i - 1].portfolioValue) / data[i - 1].portfolioValue;
    returns.push(dailyReturn);
  }

  returns.sort((a, b) => a - b);
  
  const var95Index = Math.floor(returns.length * 0.05);
  const var99Index = Math.floor(returns.length * 0.01);

  return {
    var95: returns[var95Index] * 100,
    var99: returns[var99Index] * 100,
    beta: 0.87, // Simplified - would need market data for actual calculation
    correlation: 0.75 // Simplified correlation with gold
  };
}

function calculateBenchmarkComparison(portfolioData: HistoricalData[], goldPriceData: any[]) {
  if (portfolioData.length < 2 || goldPriceData.length < 2) {
    return {
      name: 'Gold Spot Price',
      return: 0,
      outperformance: 0
    };
  }

  const initialGoldPrice = goldPriceData[0].usd_per_oz;
  const finalGoldPrice = goldPriceData[goldPriceData.length - 1].usd_per_oz;
  const goldReturn = ((finalGoldPrice - initialGoldPrice) / initialGoldPrice) * 100;

  const initialPortfolioValue = portfolioData[0].portfolioValue;
  const finalPortfolioValue = portfolioData[portfolioData.length - 1].portfolioValue;
  const portfolioReturn = ((finalPortfolioValue - initialPortfolioValue) / initialPortfolioValue) * 100;

  return {
    name: 'Gold Spot Price',
    return: goldReturn,
    outperformance: portfolioReturn - goldReturn
  };
}