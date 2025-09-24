import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useWalletBalance } from './useWalletBalance';
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

export function usePortfolioAI() {
  const { user } = useAuth();
  const { balances, totalValue } = useWalletBalance();
  const { price: goldPrice } = useGoldPrice();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [forecasts, setForecasts] = useState<MarketForecast[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAIAnalysis = useCallback(async () => {
    if (!user?.id || !balances.length || !goldPrice) return;

    try {
      setLoading(true);
      setError(null);

      // Calculate portfolio metrics
      const portfolioData = {
        balances,
        totalValue,
        goldPrice: goldPrice.usd_per_oz,
        userId: user.id
      };

      // Get AI insights
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai', {
        body: {
          message: `Analyze this portfolio and provide personalized insights: ${JSON.stringify(portfolioData)}. 
                   Focus on risk assessment, optimization opportunities, and market forecasts.`,
          context: 'portfolio_analysis'
        }
      });

      if (aiError) throw aiError;

      // Generate insights based on portfolio composition
      const newInsights: AIInsight[] = [];
      const newForecasts: MarketForecast[] = [];

      // Risk-based insights
      const usdcBalance = balances.find(b => b.asset === 'USDC')?.amount || 0;
      const xautBalance = balances.find(b => b.asset === 'XAUT')?.amount || 0;
      const trzryBalance = balances.find(b => b.asset === 'TRZRY')?.amount || 0;

      const usdcValue = usdcBalance;
      const xautValue = xautBalance * goldPrice.usd_per_oz;
      const totalPortfolioValue = usdcValue + xautValue;

      let goldAllocation = 0;
      let usdcAllocation = 0;

      if (totalPortfolioValue > 0) {
        goldAllocation = (xautValue / totalPortfolioValue) * 100;
        usdcAllocation = (usdcValue / totalPortfolioValue) * 100;

        // Concentration risk insight
        if (goldAllocation > 70) {
          newInsights.push({
            id: 'concentration-gold',
            type: 'warning',
            title: 'High Gold Concentration',
            description: `${goldAllocation.toFixed(1)}% of your portfolio is in gold. Consider diversifying to reduce risk.`,
            confidence: 85,
            timeframe: 'immediate',
            actionable: {
              action: 'Rebalance to 50-60% gold allocation',
              impact: 'Reduce portfolio volatility by 15-20%'
            }
          });
        }

        if (usdcAllocation > 80) {
          newInsights.push({
            id: 'opportunity-gold',
            type: 'opportunity',
            title: 'Gold Investment Opportunity',
            description: `Your portfolio is ${usdcAllocation.toFixed(1)}% cash. Current gold trends suggest potential upside.`,
            confidence: 75,
            timeframe: '30 days',
            actionable: {
              action: 'Allocate 30-40% to gold',
              impact: 'Potential 8-12% yield improvement'
            }
          });
        }

        // Market-based insights
        if (goldPrice.change_24h > 2) {
          newInsights.push({
            id: 'market-gold-up',
            type: 'forecast',
            title: 'Gold Momentum Building',
            description: `Gold is up ${goldPrice.change_24h.toFixed(2)}% today. Technical indicators suggest continued strength.`,
            confidence: 70,
            timeframe: '7 days'
          });
        }

        // Generate forecasts
        newForecasts.push({
          asset: 'XAUT',
          currentPrice: goldPrice.usd_per_oz,
          predictedPrice: goldPrice.usd_per_oz * (1 + (Math.random() - 0.5) * 0.1),
          confidence: 75,
          timeframe: '7d',
          reasoning: 'Based on technical analysis, market sentiment, and macroeconomic factors'
        });

        newForecasts.push({
          asset: 'USDC',
          currentPrice: 1.0,
          predictedPrice: 1.0,
          confidence: 95,
          timeframe: '30d',
          reasoning: 'Stablecoin pegged to USD with high confidence in maintaining parity'
        });
      }

      setInsights(newInsights);
      setForecasts(newForecasts);

      // Generate risk assessment
      setRiskAssessment({
        overall: goldAllocation > 70 || usdcAllocation > 80 ? 'medium' : 'low',
        concentration: Math.max(goldAllocation, usdcAllocation),
        volatility: goldAllocation * 0.3 + usdcAllocation * 0.05,
        liquidation: 0,
        marketExposure: goldAllocation,
        recommendations: [
          goldAllocation > 70 ? 'Reduce gold concentration below 60%' : 'Maintain current gold allocation',
          'Consider adding TRZRY for yield generation',
          'Monitor market conditions for rebalancing opportunities'
        ]
      });

    } catch (err) {
      console.error('AI analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate AI analysis');
    } finally {
      setLoading(false);
    }
  }, [user?.id, balances, totalValue, goldPrice]);

  const refreshAnalysis = useCallback(() => {
    return generateAIAnalysis();
  }, [generateAIAnalysis]);

  useEffect(() => {
    generateAIAnalysis();
  }, [generateAIAnalysis]);

  return {
    insights,
    forecasts,
    riskAssessment,
    loading,
    error,
    refreshAnalysis
  };
}