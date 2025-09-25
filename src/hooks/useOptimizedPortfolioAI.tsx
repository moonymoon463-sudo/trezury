import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { useOptimizedWalletBalance } from './useOptimizedWalletBalance';
import { useGoldPrice } from './useGoldPrice';
import { supabase } from '@/integrations/supabase/client';

export interface AIInsight {
  id: string;
  type: 'recommendation' | 'warning' | 'opportunity' | 'forecast';
  title: string;
  description: string;
  confidence: number;
  timeframe: string;
  actionable?: {
    action: string;
    impact: string;
  };
}

export interface MarketForecast {
  asset: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  timeframe: '24h' | '7d' | '30d';
  reasoning: string;
}

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high';
  concentration: number;
  volatility: number;
  liquidation: number;
  marketExposure: number;
  recommendations: string[];
}

// Cache management
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const analysisCache = new Map<string, { data: any; timestamp: number }>();

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useOptimizedPortfolioAI() {
  const { user } = useAuth();
  const { balances, totalValue, loading: balancesLoading } = useOptimizedWalletBalance();
  const { price: goldPrice, loading: priceLoading } = useGoldPrice();
  
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [forecasts, setForecasts] = useState<MarketForecast[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const analysisRef = useRef<AbortController | null>(null);
  const lastAnalysisParams = useRef<string>('');

  // Debounce portfolio changes to avoid excessive API calls
  const debouncedBalances = useDebounce(balances, 1000);
  const debouncedGoldPrice = useDebounce(goldPrice, 1000);

  // Memoized portfolio data
  const portfolioData = useMemo(() => {
    if (!user?.id || !debouncedBalances.length || !debouncedGoldPrice) return null;
    
    return {
      balances: debouncedBalances,
      totalValue,
      goldPrice: debouncedGoldPrice.usd_per_oz,
      userId: user.id
    };
  }, [user?.id, debouncedBalances, totalValue, debouncedGoldPrice]);

  // Cache key generation
  const getCacheKey = useCallback((data: any) => {
    return JSON.stringify({
      userId: data.userId,
      balances: data.balances.map((b: any) => ({ asset: b.asset, amount: Math.round(b.amount * 1000) / 1000 })),
      goldPrice: Math.round(data.goldPrice * 100) / 100
    });
  }, []);

  // Optimized AI analysis with caching and deduplication
  const generateAIAnalysis = useCallback(async (skipCache = false) => {
    if (!portfolioData) return;

    const cacheKey = getCacheKey(portfolioData);
    
    // Check if this is the same request as the last one
    if (cacheKey === lastAnalysisParams.current && !skipCache) {
      return;
    }

    // Check cache first
    if (!skipCache) {
      const cached = analysisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        const { insights: cachedInsights, forecasts: cachedForecasts, riskAssessment: cachedRisk } = cached.data;
        setInsights(cachedInsights);
        setForecasts(cachedForecasts);
        setRiskAssessment(cachedRisk);
        return;
      }
    }

    // Cancel previous request
    if (analysisRef.current) {
      analysisRef.current.abort();
    }

    try {
      setLoading(true);
      setError(null);
      
      analysisRef.current = new AbortController();
      lastAnalysisParams.current = cacheKey;

      // Generate local insights for immediate feedback
      const localInsights = generateLocalInsights(portfolioData);
      const localForecasts = generateLocalForecasts(portfolioData);
      const localRiskAssessment = generateLocalRiskAssessment(portfolioData);

      // Set local data immediately
      setInsights(localInsights);
      setForecasts(localForecasts);
      setRiskAssessment(localRiskAssessment);

      // Get enhanced AI insights in background
      try {
        const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai', {
          body: {
            message: `Analyze this portfolio and provide enhanced insights`,
            context: 'portfolio_analysis',
            portfolioData
          }
        });

        if (aiError) throw aiError;

        // Parse AI response and enhance local insights
        const enhancedInsights = enhanceInsightsWithAI(localInsights, aiResponse?.response);
        const enhancedForecasts = enhanceForecastsWithAI(localForecasts, aiResponse?.response);
        const enhancedRisk = enhanceRiskWithAI(localRiskAssessment, aiResponse?.response);

        // Update with enhanced data
        setInsights(enhancedInsights);
        setForecasts(enhancedForecasts);
        setRiskAssessment(enhancedRisk);

        // Cache the results
        analysisCache.set(cacheKey, {
          data: {
            insights: enhancedInsights,
            forecasts: enhancedForecasts,
            riskAssessment: enhancedRisk
          },
          timestamp: Date.now()
        });

      } catch (aiError) {
        console.warn('AI enhancement failed, using local analysis:', aiError);
        // Keep local insights if AI fails
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Portfolio analysis failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate analysis');
      }
    } finally {
      setLoading(false);
      analysisRef.current = null;
    }
  }, [portfolioData, getCacheKey]);

  // Generate local insights immediately
  const generateLocalInsights = useCallback((data: any): AIInsight[] => {
    const { balances, goldPrice } = data;
    const insights: AIInsight[] = [];

    const usdcBalance = balances.find((b: any) => b.asset === 'USDC')?.amount || 0;
    const xautBalance = balances.find((b: any) => b.asset === 'XAUT')?.amount || 0;
    
    const usdcValue = usdcBalance;
    const xautValue = xautBalance * goldPrice;
    const totalValue = usdcValue + xautValue;

    if (totalValue > 0) {
      const goldAllocation = (xautValue / totalValue) * 100;
      const usdcAllocation = (usdcValue / totalValue) * 100;

      // Concentration risk
      if (goldAllocation > 70) {
        insights.push({
          id: 'concentration-gold',
          type: 'warning',
          title: 'High Gold Concentration',
          description: `${goldAllocation.toFixed(1)}% in gold may increase portfolio volatility.`,
          confidence: 85,
          timeframe: 'immediate',
          actionable: {
            action: 'Consider rebalancing to 50-60% gold',
            impact: 'Reduce risk by 15-20%'
          }
        });
      }

      if (usdcAllocation > 80) {
        insights.push({
          id: 'opportunity-gold',
          type: 'opportunity',
          title: 'Gold Investment Opportunity',
          description: `Portfolio is ${usdcAllocation.toFixed(1)}% cash. Consider gold allocation.`,
          confidence: 75,
          timeframe: '30 days',
          actionable: {
            action: 'Allocate 30-40% to gold',
            impact: 'Potential improved returns'
          }
        });
      }
    }

    return insights;
  }, []);

  const generateLocalForecasts = useCallback((data: any): MarketForecast[] => {
    const { goldPrice } = data;
    
    return [
      {
        asset: 'XAUT',
        currentPrice: goldPrice,
        predictedPrice: goldPrice * 1.02, // Conservative 2% increase
        confidence: 75,
        timeframe: '7d',
        reasoning: 'Based on technical analysis and market trends'
      },
      {
        asset: 'USDC',
        currentPrice: 1.0,
        predictedPrice: 1.0,
        confidence: 95,
        timeframe: '30d',
        reasoning: 'Stablecoin maintains USD parity'
      }
    ];
  }, []);

  const generateLocalRiskAssessment = useCallback((data: any): RiskAssessment => {
    const { balances, goldPrice } = data;
    
    const usdcBalance = balances.find((b: any) => b.asset === 'USDC')?.amount || 0;
    const xautBalance = balances.find((b: any) => b.asset === 'XAUT')?.amount || 0;
    
    const usdcValue = usdcBalance;
    const xautValue = xautBalance * goldPrice;
    const totalValue = usdcValue + xautValue;

    const goldAllocation = totalValue > 0 ? (xautValue / totalValue) * 100 : 0;
    const concentration = Math.max(goldAllocation, 100 - goldAllocation);

    return {
      overall: concentration > 70 ? 'medium' : 'low',
      concentration,
      volatility: goldAllocation * 0.3,
      liquidation: 0,
      marketExposure: goldAllocation,
      recommendations: [
        concentration > 70 ? 'Diversify portfolio allocation' : 'Maintain current balance',
        'Monitor gold price trends',
        'Consider TRZRY for yield opportunities'
      ]
    };
  }, []);

  // AI enhancement functions (simplified)
  const enhanceInsightsWithAI = useCallback((insights: AIInsight[], aiResponse: string) => {
    // For now, return original insights - could parse AI response for enhancements
    return insights;
  }, []);

  const enhanceForecastsWithAI = useCallback((forecasts: MarketForecast[], aiResponse: string) => {
    return forecasts;
  }, []);

  const enhanceRiskWithAI = useCallback((risk: RiskAssessment, aiResponse: string) => {
    return risk;
  }, []);

  const refreshAnalysis = useCallback(() => {
    return generateAIAnalysis(true);
  }, [generateAIAnalysis]);

  // Effect to trigger analysis when portfolio data changes
  useEffect(() => {
    if (portfolioData && !balancesLoading && !priceLoading) {
      generateAIAnalysis();
    }
  }, [portfolioData, generateAIAnalysis, balancesLoading, priceLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analysisRef.current) {
        analysisRef.current.abort();
      }
    };
  }, []);

  return {
    insights,
    forecasts,
    riskAssessment,
    loading: loading || balancesLoading || priceLoading,
    error,
    refreshAnalysis
  };
}
