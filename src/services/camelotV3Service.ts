import { supabase } from "@/integrations/supabase/client";

/**
 * Camelot V3 Service
 * Direct integration with Camelot V3 (Algebra-based) on Arbitrum
 * Used as fallback when 0x API doesn't have routes
 */

export interface CamelotQuote {
  amountOut: string;
  amountOutFormatted: number;
  source: 'camelot_v3';
  pool?: string;
  gasEstimate?: string;
}

class CamelotV3Service {
  /**
   * Get quote from Camelot V3 via blockchain-operations edge function
   */
  async getQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<CamelotQuote> {
    try {
      console.log('📊 Fetching Camelot V3 quote via edge function:', {
        tokenIn,
        tokenOut,
        amountIn
      });

      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'camelot_quote',
          chainId: 42161,
          tokenIn,
          tokenOut,
          amountIn
        }
      });

      console.log('🟣 Camelot edge function raw response:', { data, error });

      if (error) {
        console.error('Camelot V3 quote error:', error);
        throw new Error(`Camelot V3 quote failed: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Camelot V3 quote failed');
      }

      console.log('✅ Camelot V3 quote received:', data);

      return {
        amountOut: data.amountOut,
        amountOutFormatted: data.amountOutFormatted,
        source: 'camelot_v3',
        pool: data.pool,
        gasEstimate: data.gasEstimate
      };
    } catch (error) {
      console.error('Error getting Camelot V3 quote:', error);
      throw error;
    }
  }
}

export const camelotV3Service = new CamelotV3Service();
