import { supabase } from "@/integrations/supabase/client";

export interface SwapFeeCalculation {
  feeAmount: number;
  feeAsset: 'USDC' | 'XAUT';
  platformFeeWallet: string;
  remainingAmount: number;
}

class SwapFeeService {
  private readonly PLATFORM_FEE_BPS = 80; // Standardized 0.8% platform fee
  private readonly PLATFORM_FEE_WALLET = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835';

  /**
   * Calculate swap fee in the output token (XAUT or USDC) instead of ETH
   */
  calculateSwapFee(
    outputAmount: number, 
    outputAsset: 'USDC' | 'XAUT',
    inputAsset: 'USDC' | 'XAUT'
  ): SwapFeeCalculation {
    // Take fee from the output token to avoid ETH gas fees
    const feeAmount = (outputAmount * this.PLATFORM_FEE_BPS) / 10000;
    const remainingAmount = outputAmount - feeAmount;

    return {
      feeAmount: Number(feeAmount.toFixed(6)),
      feeAsset: outputAsset,
      platformFeeWallet: this.PLATFORM_FEE_WALLET,
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
  getPlatformFeeWallet(): string {
    return this.PLATFORM_FEE_WALLET;
  }

  /**
   * Calculate total fees including base + platform fees
   */
  calculateTotalFees(baseAmount: number): {
    totalFee: number;
    netAmount: number;
  } {
    // Standardized 0.8% total fee
    const totalFee = (baseAmount * this.PLATFORM_FEE_BPS) / 10000;
    const netAmount = baseAmount - totalFee;

    return {
      totalFee: Number(totalFee.toFixed(6)),
      netAmount: Number(netAmount.toFixed(6))
    };
  }
}

export const swapFeeService = new SwapFeeService();