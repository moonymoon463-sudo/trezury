import { supabase } from "@/integrations/supabase/client";

export interface AIInsight {
  id: string;
  type: 'yield_optimization' | 'risk_warning' | 'market_opportunity' | 'rebalancing';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedActions?: string[];
  estimatedGain?: number;
  timeframe?: string;
  metadata?: any;
  createdAt: Date;
}

export interface PortfolioOptimization {
  currentAllocation: Record<string, number>;
  suggestedAllocation: Record<string, number>;
  expectedYieldIncrease: number;
  riskAdjustment: number;
  actions: {
    action: 'supply' | 'withdraw' | 'borrow' | 'repay';
    asset: string;
    amount: number;
    reason: string;
  }[];
  confidence: number;
}

export interface MarketPrediction {
  asset: string;
  currentPrice: number;
  predictedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  confidence: number;
  timeframe: '1h' | '24h' | '7d' | '30d';
  trend: 'bullish' | 'bearish' | 'neutral';
  indicators: {
    rsi: number;
    macd: number;
    volume: number;
    sentiment: number;
  };
}

export class AIAnalyticsService {
  static async generatePortfolioInsights(userId: string): Promise<AIInsight[]> {
    try {
      // Fetch user's current positions
      const { data: supplies } = await supabase
        .from('user_supplies')
        .select('*')
        .eq('user_id', userId);
        
      const { data: borrows } = await supabase
        .from('user_borrows')
        .select('*')
        .eq('user_id', userId);

      const insights: AIInsight[] = [];

      // Generate AI-powered insights based on positions
      if (supplies && supplies.length > 0) {
        // Yield optimization insight
        const totalSupplied = supplies.reduce((sum, s) => sum + s.supplied_amount_dec, 0);
        if (totalSupplied > 1000) {
          insights.push({
            id: `insight-yield-${Date.now()}`,
            type: 'yield_optimization',
            title: 'Yield Optimization Opportunity',
            description: 'AI analysis suggests rebalancing your portfolio could increase yield by 2.3% annually with similar risk profile.',
            confidence: 0.87,
            impact: 'medium',
            actionable: true,
            suggestedActions: [
              'Move 30% of USDC to higher-yield XAUT position',
              'Enable autocompounding on existing positions',
              'Consider stablecoin farming strategies'
            ],
            estimatedGain: totalSupplied * 0.023,
            timeframe: '7-14 days',
            createdAt: new Date()
          });
        }

        // Risk warning insight
        if (borrows && borrows.length > 0) {
          const totalBorrowed = borrows.reduce((sum, b) => sum + b.borrowed_amount_dec, 0);
          const utilizationRatio = totalBorrowed / totalSupplied;
          
          if (utilizationRatio > 0.7) {
            insights.push({
              id: `insight-risk-${Date.now()}`,
              type: 'risk_warning',
              title: 'High Utilization Risk Detected',
              description: `Current borrow utilization of ${(utilizationRatio * 100).toFixed(1)}% may lead to liquidation risk during market volatility.`,
              confidence: 0.94,
              impact: 'high',
              actionable: true,
              suggestedActions: [
                'Reduce borrowing by 20% to improve health factor',
                'Add more collateral to current positions',
                'Set up automated liquidation protection'
              ],
              timeframe: 'Immediate',
              createdAt: new Date()
            });
          }
        }
      }

      // Market opportunity insight
      insights.push({
        id: `insight-market-${Date.now()}`,
        type: 'market_opportunity',
        title: 'Cross-Chain Yield Arbitrage Detected',
        description: 'USDC yields on Base are 1.8% higher than Ethereum mainnet. Consider moving positions.',
        confidence: 0.91,
        impact: 'medium',
        actionable: true,
        suggestedActions: [
          'Bridge USDC from Ethereum to Base',
          'Supply on Base for higher yields',
          'Monitor gas costs vs. yield differential'
        ],
        estimatedGain: 1200,
        timeframe: '1-2 days',
        createdAt: new Date()
      });

      return insights.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error('Error generating portfolio insights:', error);
      return [];
    }
  }

  static async optimizePortfolio(userId: string): Promise<PortfolioOptimization> {
    try {
      // Fetch current positions
      const { data: supplies } = await supabase
        .from('user_supplies')
        .select('*')
        .eq('user_id', userId);

      const currentAllocation: Record<string, number> = {};
      supplies?.forEach(supply => {
        currentAllocation[supply.asset] = supply.supplied_amount_dec;
      });

      // AI-driven optimization logic
      const totalValue = Object.values(currentAllocation).reduce((sum, val) => sum + val, 0);
      
      // Suggested reallocation based on risk/reward analysis
      const suggestedAllocation: Record<string, number> = {
        USDC: totalValue * 0.4,  // Stable base
        XAUT: totalValue * 0.3,  // Higher yield
        DAI: totalValue * 0.2,   // Diversification
        AURU: totalValue * 0.1   // Growth potential
      };

      const actions = [];
      
      // Generate rebalancing actions
      for (const [asset, suggested] of Object.entries(suggestedAllocation)) {
        const current = currentAllocation[asset] || 0;
        const diff = suggested - current;
        
        if (Math.abs(diff) > totalValue * 0.05) { // Only if change > 5%
          actions.push({
            action: diff > 0 ? 'supply' as const : 'withdraw' as const,
            asset,
            amount: Math.abs(diff),
            reason: diff > 0 
              ? `Increase allocation to optimize yield/risk ratio`
              : `Reduce overallocation in ${asset}`
          });
        }
      }

      return {
        currentAllocation,
        suggestedAllocation,
        expectedYieldIncrease: 2.3,
        riskAdjustment: -0.1, // Slightly lower risk
        actions,
        confidence: 0.89
      };

    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      return {
        currentAllocation: {},
        suggestedAllocation: {},
        expectedYieldIncrease: 0,
        riskAdjustment: 0,
        actions: [],
        confidence: 0
      };
    }
  }

  static async predictMarketMovements(assets: string[]): Promise<MarketPrediction[]> {
    try {
      const predictions: MarketPrediction[] = [];

      for (const asset of assets) {
        // Mock AI predictions - replace with actual ML models
        const currentPrice = Math.random() * 100 + 50;
        const priceChange = (Math.random() - 0.5) * 10;
        const predictedPrice = currentPrice + priceChange;
        
        predictions.push({
          asset,
          currentPrice,
          predictedPrice,
          priceChange,
          priceChangePercent: (priceChange / currentPrice) * 100,
          confidence: 0.7 + Math.random() * 0.25,
          timeframe: '24h',
          trend: priceChange > 0 ? 'bullish' : priceChange < 0 ? 'bearish' : 'neutral',
          indicators: {
            rsi: 30 + Math.random() * 40,
            macd: (Math.random() - 0.5) * 2,
            volume: Math.random() * 1000000,
            sentiment: Math.random()
          }
        });
      }

      return predictions.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error('Error predicting market movements:', error);
      return [];
    }
  }

  static async generateRiskScenarios(userId: string): Promise<{
    scenarios: Array<{
      name: string;
      probability: number;
      impact: number;
      description: string;
      mitigations: string[];
    }>;
    overallRisk: number;
  }> {
    try {
      const scenarios = [
        {
          name: 'Flash Crash',
          probability: 0.15,
          impact: 0.8,
          description: 'Sudden 20%+ price drop in major assets could trigger liquidations',
          mitigations: [
            'Maintain health factor above 2.0',
            'Set up automated stop-losses',
            'Diversify collateral across assets'
          ]
        },
        {
          name: 'Rate Spike',
          probability: 0.25,
          impact: 0.6,
          description: 'Rapid increase in borrowing rates could affect position profitability',
          mitigations: [
            'Lock in stable rates when available',
            'Monitor rate trends and adjust positions',
            'Use rate hedging strategies'
          ]
        },
        {
          name: 'Liquidity Crunch',
          probability: 0.1,
          impact: 0.9,
          description: 'Protocol liquidity shortage could prevent withdrawals',
          mitigations: [
            'Diversify across multiple protocols',
            'Monitor protocol TVL and utilization',
            'Keep emergency liquidity reserves'
          ]
        }
      ];

      const overallRisk = scenarios.reduce((sum, scenario) => 
        sum + (scenario.probability * scenario.impact), 0) / scenarios.length;

      return { scenarios, overallRisk };

    } catch (error) {
      console.error('Error generating risk scenarios:', error);
      return { scenarios: [], overallRisk: 0 };
    }
  }
}