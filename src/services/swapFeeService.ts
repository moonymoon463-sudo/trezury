import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_RECIPIENT, PLATFORM_FEE_BPS } from "@/config/platformFees";

export interface SwapFeeCalculation {
  feeAmount: number;
  feeAsset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY' | 'BTC';
  platformFeeWallet: string;
  remainingAmount: number;
}

class SwapFeeService {
  private readonly ELIGIBLE_TOKENS = ['ETH', 'USDC', 'XAUT', 'TRZRY', 'BTC'];

  /**
   * Check if fee should be applied (only for eligible token pairs)
   */
  shouldApplyFee(inputAsset: string, outputAsset: string): boolean {
    return this.ELIGIBLE_TOKENS.includes(inputAsset) && 
           this.ELIGIBLE_TOKENS.includes(outputAsset);
  }

  /**
   * Calculate swap fee from the INPUT token (deducted before swap)
   */
  calculateSwapFee(
    inputAmount: number,
    inputAsset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY' | 'BTC',
    outputAsset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY' | 'BTC'
  ): SwapFeeCalculation {
    if (!this.shouldApplyFee(inputAsset, outputAsset)) {
      return {
        feeAmount: 0,
        feeAsset: inputAsset,
        platformFeeWallet: PLATFORM_FEE_RECIPIENT,
        remainingAmount: inputAmount
      };
    }
    
    // Take fee from INPUT token before swap
    const feeAmount = (inputAmount * PLATFORM_FEE_BPS) / 10000;
    const remainingAmount = inputAmount - feeAmount;

    return {
      feeAmount: Number(feeAmount.toFixed(6)),
      feeAsset: inputAsset,
      platformFeeWallet: PLATFORM_FEE_RECIPIENT,
      remainingAmount: Number(remainingAmount.toFixed(6))
    };
  }

  /**
   * Record fee collection transaction for tracking
   */
  async recordSwapFeeCollection(
    userId: string,
    transactionId: string,
    feeCalculation: SwapFeeCalculation
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate transaction exists
      const { data: txExists } = await supabase
        .from('transactions')
        .select('id')
        .eq('id', transactionId)
        .maybeSingle();

      if (!txExists) {
        return { success: false, error: 'Transaction not found' };
      }

      // Record the fee as a separate balance snapshot for the platform wallet
      const { error: snapshotError } = await supabase
        .from('balance_snapshots')
        .insert({
          user_id: userId, // Keep user_id for RLS, but mark as platform fee in metadata
          asset: feeCalculation.feeAsset, // Already using actual token names (XAUT or USDC)
          amount: feeCalculation.feeAmount,
          snapshot_at: new Date().toISOString(),
        });

      if (snapshotError) {
        console.error('Failed to record swap fee collection:', snapshotError);
        return { success: false, error: snapshotError.message };
      }

      // Update transaction metadata to include fee information
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          metadata: {
            platformFee: {
              amount: feeCalculation.feeAmount,
              asset: feeCalculation.feeAsset,
              wallet: feeCalculation.platformFeeWallet,
              type: 'swap_fee'
            }
          }
        })
        .eq('id', transactionId);

      if (updateError) {
        console.error('Failed to update transaction metadata:', updateError);
        return { success: false, error: updateError.message };
      }

      return { success: true };

    } catch (err) {
      console.error('Error recording swap fee collection:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Get platform fee wallet address
   */
  getWalletAddress(): string {
    return PLATFORM_FEE_RECIPIENT;
  }

  /**
   * Calculate total fees including base + platform fees
   */
  calculateTotalFees(baseAmount: number): {
    totalFee: number;
    netAmount: number;
  } {
    // Standardized 0.8% total fee
    const totalFee = (baseAmount * PLATFORM_FEE_BPS) / 10000;
    const netAmount = baseAmount - totalFee;

    return {
      totalFee: Number(totalFee.toFixed(6)),
      netAmount: Number(netAmount.toFixed(6))
    };
  }
}

export const swapFeeService = new SwapFeeService();