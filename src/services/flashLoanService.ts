import { supabase } from "@/integrations/supabase/client";

export interface FlashLoanOpportunity {
  id: string;
  type: 'arbitrage' | 'liquidation' | 'refinancing';
  asset: string;
  amount: number;
  estimatedProfit: number;
  gasEstimate: number;
  riskLevel: 'low' | 'medium' | 'high';
  protocols: string[];
  deadline: number;
}

export interface FlashLoanExecution {
  asset: string;
  amount: number;
  recipient: string;
  params: Record<string, any>;
}

export class FlashLoanService {
  
  static async getAvailableOpportunities(): Promise<FlashLoanOpportunity[]> {
    try {
      const response = await supabase.functions.invoke('flash-loan-opportunities', {
        body: { action: 'scan_opportunities' }
      });

      if (response.error) {
        throw new Error(`Failed to get opportunities: ${response.error.message}`);
      }

      return response.data?.opportunities || [];
    } catch (error) {
      console.error('Error getting flash loan opportunities:', error);
      throw error;
    }
  }

  static async executeFlashLoan(params: FlashLoanExecution): Promise<any> {
    try {
      const response = await supabase.functions.invoke('flash-loan-execution', {
        body: { 
          action: 'execute_flash_loan',
          ...params
        }
      });

      if (response.error) {
        throw new Error(`Flash loan execution failed: ${response.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error executing flash loan:', error);
      throw error;
    }
  }

  static async simulateFlashLoan(params: FlashLoanExecution): Promise<any> {
    try {
      const response = await supabase.functions.invoke('flash-loan-simulation', {
        body: { 
          action: 'simulate',
          ...params
        }
      });

      if (response.error) {
        throw new Error(`Flash loan simulation failed: ${response.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error simulating flash loan:', error);
      throw error;
    }
  }

  static async getFlashLoanHistory(userId?: string): Promise<any[]> {
    try {
      const response = await supabase.functions.invoke('flash-loan-history', {
        body: { 
          action: 'get_history',
          user_id: userId
        }
      });

      if (response.error) {
        throw new Error(`Failed to get flash loan history: ${response.error.message}`);
      }

      return response.data?.history || [];
    } catch (error) {
      console.error('Error fetching flash loan history:', error);
      throw error;
    }
  }

  static calculateFlashLoanFee(amount: number, asset: string): number {
    // 0.09% flash loan fee (9 basis points)
    const feeRate = 0.0009;
    return amount * feeRate;
  }

  static formatFlashLoanAmount(amount: number, asset: string): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount) + ` ${asset}`;
  }

  static getRiskColor(risk: string): string {
    switch (risk) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  }
}