import { supabase } from "@/integrations/supabase/client";

export interface RiskParameters {
  asset: string;
  chain: string;
  ltv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  volatilityMultiplier: number;
  lastUpdated: string;
}

export interface PortfolioRisk {
  totalCollateralUsd: number;
  totalDebtUsd: number;
  diversificationScore: number;
  concentrationRisks: Array<{
    asset: string;
    percentage: number;
    riskLevel: string;
  }>;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface StressTestResult {
  scenario: string;
  priceChanges: Record<string, number>;
  resultingHealthFactor: number;
  liquidationRisk: boolean;
  actionRequired: boolean;
}

export class AdvancedRiskService {
  
  static async updateRiskParameters(volatilityData: Record<string, number>): Promise<void> {
    try {
      const response = await supabase.functions.invoke('risk-parameter-update', {
        body: { 
          action: 'update_parameters',
          volatility_data: volatilityData
        }
      });

      if (response.error) {
        throw new Error(`Failed to update risk parameters: ${response.error.message}`);
      }
    } catch (error) {
      console.error('Error updating risk parameters:', error);
      throw error;
    }
  }

  static async getPortfolioRiskAssessment(userId: string): Promise<PortfolioRisk> {
    try {
      const response = await supabase.functions.invoke('portfolio-risk-analysis', {
        body: { 
          action: 'assess_portfolio',
          user_id: userId
        }
      });

      if (response.error) {
        throw new Error(`Failed to assess portfolio risk: ${response.error.message}`);
      }

      return response.data.portfolio_risk;
    } catch (error) {
      console.error('Error getting portfolio risk assessment:', error);
      throw error;
    }
  }

  static async runStressTest(userId: string, scenarios: string[]): Promise<StressTestResult[]> {
    try {
      const response = await supabase.functions.invoke('stress-testing', {
        body: { 
          action: 'run_stress_test',
          user_id: userId,
          scenarios
        }
      });

      if (response.error) {
        throw new Error(`Failed to run stress test: ${response.error.message}`);
      }

      return response.data.results || [];
    } catch (error) {
      console.error('Error running stress test:', error);
      throw error;
    }
  }

  static async getAdvancedPositionLimits(userId: string): Promise<any> {
    try {
      const response = await supabase.functions.invoke('advanced-position-limits', {
        body: { 
          action: 'get_limits',
          user_id: userId
        }
      });

      if (response.error) {
        throw new Error(`Failed to get advanced position limits: ${response.error.message}`);
      }

      return response.data?.limits || [];
    } catch (error) {
      console.error('Error fetching advanced position limits:', error);
      throw error;
    }
  }

  static async setTieredRiskLimits(
    userId: string,
    tier: 'bronze' | 'silver' | 'gold' | 'platinum',
    limits: Record<string, any>
  ): Promise<void> {
    try {
      const response = await supabase.functions.invoke('advanced-position-limits', {
        body: { 
          action: 'set_limits',
          user_id: userId,
          tier,
          limits
        }
      });

      if (response.error) {
        throw new Error(`Failed to set tiered risk limits: ${response.error.message}`);
      }
    } catch (error) {
      console.error('Error setting tiered risk limits:', error);
      throw error;
    }
  }

  static calculateDiversificationScore(positions: Array<{asset: string, value: number}>): number {
    if (positions.length === 0) return 0;
    
    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
    const weights = positions.map(pos => pos.value / totalValue);
    
    // Calculate Herfindahl-Hirschman Index (lower = more diversified)
    const hhi = weights.reduce((sum, weight) => sum + Math.pow(weight, 2), 0);
    
    // Convert to diversification score (0-100, higher = more diversified)
    return Math.max(0, (1 - hhi) * 100);
  }

  static getConcentrationRisks(positions: Array<{asset: string, value: number}>): Array<{
    asset: string;
    percentage: number;
    riskLevel: string;
  }> {
    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
    
    return positions.map(pos => {
      const percentage = (pos.value / totalValue) * 100;
      let riskLevel = 'low';
      
      if (percentage > 60) riskLevel = 'critical';
      else if (percentage > 40) riskLevel = 'high';
      else if (percentage > 25) riskLevel = 'medium';
      
      return {
        asset: pos.asset,
        percentage,
        riskLevel
      };
    }).filter(risk => risk.percentage > 10); // Only show significant concentrations
  }

  static generateRiskRecommendations(portfolioRisk: PortfolioRisk): string[] {
    const recommendations: string[] = [];
    
    if (portfolioRisk.diversificationScore < 30) {
      recommendations.push('Consider diversifying your collateral across more assets');
    }
    
    portfolioRisk.concentrationRisks.forEach(risk => {
      if (risk.riskLevel === 'critical') {
        recommendations.push(`Reduce ${risk.asset} exposure (currently ${risk.percentage.toFixed(1)}%)`);
      }
    });
    
    if (portfolioRisk.totalDebtUsd / portfolioRisk.totalCollateralUsd > 0.7) {
      recommendations.push('Consider reducing leverage by repaying some debt');
    }
    
    return recommendations;
  }

  static formatRiskPercentage(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  static getRiskLevelColor(level: string): string {
    switch (level) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
      case 'critical': return 'text-destructive font-bold';
      default: return 'text-muted-foreground';
    }
  }
}