import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { useGoldPrice } from './useGoldPrice';
import { useIsMobile } from './use-mobile';
import { secureWalletService } from '@/services/secureWalletService';
import { supabase } from '@/integrations/supabase/client';

export interface WalletBalance {
  asset: string;
  amount: number;
  chain: string;
}

export interface PortfolioAsset {
  asset: string;
  name: string;
  value: number;
  valueUSD: number;
  balance: number;
  allocation: number;
  apy?: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalValueUSD: number;
  totalGains: number;
  totalGainsPercent: number;
  healthFactor: number;
  netApy: number;
}

export interface PortfolioPerformance {
  period: string;
  return: number;
  percentage: number;
}

// Aggressive caching for performance
const MOBILE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for mobile
const DESKTOP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for desktop
const portfolioCache = new Map<string, { data: any; timestamp: number }>();

// Request deduplication for mobile
const pendingRequests = new Map<string, Promise<any>>();

export function useMobileOptimizedPortfolio() {
  const { user } = useAuth();
  const { price: goldPrice, loading: goldPriceLoading } = useGoldPrice();
  const isMobile = useIsMobile();
  
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalValueUSD: 0,
    totalGains: 0,
    totalGainsPercent: 0,
    healthFactor: 1,
    netApy: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Keep track of last known good values for seamless mobile experience
  const lastKnownGoldPrice = useRef<any>(null);
  const lastKnownAssets = useRef<PortfolioAsset[]>([]);
  const hasInitialLoad = useRef(false);

  // Mobile-specific cache duration
  const cacheDuration = isMobile ? MOBILE_CACHE_DURATION : DESKTOP_CACHE_DURATION;

  // Check cache first for mobile optimization
  const getCachedData = useCallback((key: string) => {
    const cached = portfolioCache.get(key);
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      return cached.data;
    }
    return null;
  }, [cacheDuration]);

  // Set cache with mobile-optimized expiry
  const setCachedData = useCallback((key: string, data: any) => {
    portfolioCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);

  // Fast balance fetching with immediate cache return
  const fetchBalances = useCallback(async (forceRefresh = false, silent = false): Promise<WalletBalance[]> => {
    if (!user?.id) return [];

    const cacheKey = `balances_${user.id}`;
    
    // Show cached data immediately for fast loading
    if (!forceRefresh) {
      const cached = getCachedData(cacheKey);
      if (cached) {
        console.log('📦 Showing cached balances immediately');
        return cached;
      }
    }

    // Deduplicate requests
    if (pendingRequests.has(cacheKey)) {
      console.log('📱 Deduplicating balance request');
      return pendingRequests.get(cacheKey)!;
    }

    const request = async (): Promise<WalletBalance[]> => {
      try {
        const address = await secureWalletService.getWalletAddress(user.id);
        if (!address) {
          console.log('📱 No wallet address found');
          return [];
        }

        setWalletAddress(address);

        // Aggressive timeout reduction for fast loading
        const timeoutMs = isMobile ? 3000 : 2000; // 3s mobile, 2s desktop
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          console.log(`📱 Fetching balances for mobile: ${isMobile}`);
          
          const { data, error } = await supabase.functions.invoke('blockchain-operations', {
            body: {
              operation: 'get_all_balances',
              address: address
            }
          });

          clearTimeout(timeoutId);

          if (error) throw error;

          // Process successful balances only (ignore failed individual assets)
          const processedBalances: WalletBalance[] = [];
          
          if (data?.success && data?.balances) {
            data.balances.forEach((balance: any) => {
              // Only include successful balance fetches
              if (balance.success !== false) {
                processedBalances.push({
                  asset: balance.asset,
                  amount: balance.balance || 0,
                  chain: 'ethereum'
                });
              } else {
                // For failed balances, use 0 but don't error out
                console.warn(`📱 Failed to fetch ${balance.asset} balance: ${balance.error}`);
                processedBalances.push({
                  asset: balance.asset,
                  amount: 0,
                  chain: 'ethereum'
                });
              }
            });
          }

          // Cache successful result
          setCachedData(cacheKey, processedBalances);
          return processedBalances;

        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          // Mobile-specific error handling
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timeout - check your connection');
          }
          
          // Always use cached data if available on error
          const fallbackCache = getCachedData(cacheKey);
          if (fallbackCache) {
            console.log('📦 Using fallback cache due to error');
            return fallbackCache;
          }
          
          throw fetchError;
        }

      } catch (error) {
        console.error('📱 Balance fetch failed:', error);
        
        // Return zero balances as fallback to avoid blocking UI
        return [
          { asset: 'USDC', amount: 0, chain: 'ethereum' },
          { asset: 'XAUT', amount: 0, chain: 'ethereum' },
          { asset: 'TRZRY', amount: 0, chain: 'ethereum' }
        ];
        throw error;
      }
    };

    const promise = request();
    pendingRequests.set(cacheKey, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  }, [user?.id, isMobile, getCachedData, setCachedData]);

  // Extract portfolio calculation logic for reuse with seamless mobile fallback
  const calculatePortfolioAssets = useCallback((balances: WalletBalance[], goldPrice: any): PortfolioAsset[] => {
    if (!balances.length) return lastKnownAssets.current;

    // Use current gold price or fallback to last known price for seamless mobile experience
    const effectiveGoldPrice = goldPrice?.usd_per_oz ? goldPrice : lastKnownGoldPrice.current;
    if (!effectiveGoldPrice?.usd_per_oz) {
      // If no gold price at all, return last known assets to avoid empty portfolio
      return lastKnownAssets.current;
    }

    // Store last known good price
    if (goldPrice?.usd_per_oz) {
      lastKnownGoldPrice.current = goldPrice;
    }

    const assets: PortfolioAsset[] = [];
    let totalValue = 0;

    balances.forEach(balance => {
      let valueUSD = 0;
      let apy = 0;

      switch (balance.asset) {
        case 'USDC':
          valueUSD = balance.amount;
          apy = 0;
          break;
        case 'XAUT':
          valueUSD = balance.amount * effectiveGoldPrice.usd_per_oz;
          apy = 0;
          break;
        case 'TRZRY':
          valueUSD = balance.amount;
          apy = 5.2;
          break;
      }

      if (valueUSD > 0 || balance.amount >= 0) {
        assets.push({
          asset: balance.asset,
          name: balance.asset,
          value: valueUSD,
          valueUSD: valueUSD,
          balance: balance.amount,
          allocation: 0, // Will be calculated after totalValue
          apy
        });
      }

      totalValue += valueUSD;
    });

    // Calculate allocations
    const calculatedAssets = assets.map(asset => ({
      ...asset,
      allocation: totalValue > 0 ? (asset.value / totalValue) * 100 : 0
    }));

    // Store as last known good assets
    if (calculatedAssets.length > 0) {
      lastKnownAssets.current = calculatedAssets;
    }

    return calculatedAssets;
  }, []);

  // Calculate portfolio assets with mobile optimization
  const portfolioAssets = useMemo((): PortfolioAsset[] => {
    return calculatePortfolioAssets(balances, goldPrice);
  }, [balances, goldPrice, calculatePortfolioAssets]);

  // Calculate portfolio summary
  const calculateSummary = useCallback((assets: PortfolioAsset[]): PortfolioSummary => {
    const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
    const weightedApy = assets.reduce((sum, asset) => {
      return sum + (asset.apy || 0) * (asset.value / totalValue || 0);
    }, 0);

    return {
      totalValue,
      totalValueUSD: totalValue,
      totalGains: 0, // Would need historical data
      totalGainsPercent: 0,
      healthFactor: 1,
      netApy: isNaN(weightedApy) ? 0 : weightedApy
    };
  }, []);

  // Background refresh function for fast loading
  const refreshData = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;

    try {
      setError(null);
      
      // Background refresh: fetch fresh data silently
      console.log('🔄 Background refresh started...');
      const newBalances = await fetchBalances(forceRefresh, true);
      setBalances(newBalances);

      // Calculate assets directly to avoid race condition with useMemo
      const freshAssets = calculatePortfolioAssets(newBalances, goldPrice);
      const summary = calculateSummary(freshAssets);
      setPortfolioSummary(summary);

      hasInitialLoad.current = true;
      console.log('✅ Background refresh completed');

    } catch (err) {
      console.error('❌ Background refresh failed:', err);
      // Don't show error for background refresh
    }
  }, [user?.id, fetchBalances, goldPrice, calculatePortfolioAssets, calculateSummary]);

  // Fast initial load with background refresh
  useEffect(() => {
    if (user?.id) {
      // Fast initial load
      fetchBalances().then((balances) => {
        setBalances(balances);
        const assets = calculatePortfolioAssets(balances, goldPrice);
        const summary = calculateSummary(assets);
        setPortfolioSummary(summary);
        setLoading(false);
        hasInitialLoad.current = true;
        
        // Schedule background refresh after 2 seconds
        setTimeout(() => {
          refreshData(true);
        }, 2000);
      });
    }
  }, [user?.id, fetchBalances, goldPrice, calculatePortfolioAssets, calculateSummary, refreshData]);

  // Network status monitoring for mobile
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (user?.id) {
        fetchBalances(true, true); // Silent refresh when coming back online
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.id, refreshData]);

  return {
    balances,
    portfolioAssets,
    portfolioSummary,
    loading,
    error,
    isOffline,
    walletAddress,
    isMobile,
    refreshData: () => refreshData(true),
    // Quick access functions
    getBalance: (asset: string) => balances.find(b => b.asset === asset)?.amount || 0,
    totalValue: portfolioSummary.totalValue
  };
}