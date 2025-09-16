import { supabase } from "@/integrations/supabase/client";

export interface SwapFeeCalculation {
  feeAmount: number;
  feeAsset: 'USDC' | 'GOLD';
  platformFeeWallet: string;
  remainingAmount: number;
}

class SwapFeeService {
  private readonly PLATFORM_FEE_BPS = 100; // 1% platform fee
  private readonly PLATFORM_FEE_WALLET = 'BzSNDYfdEf8Q2wpr3rvrqQyreAWqB25AnmQA6XohUNom';

  /**
   * Calculate swap fee in the output token (GOLD or USDC) instead of ETH
   */
  calculateSwapFee(
    outputAmount: number, 
    outputAsset: 'USDC' | 'GOLD',
    inputAsset: 'USDC' | 'GOLD'
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
  ): Promise<void> {
    try {
      // Record the fee as a separate balance snapshot for the platform wallet
      const { error } = await supabase
        .from('balance_snapshots')
        .insert({
          user_id: userId, // Keep user_id for RLS, but mark as platform fee in metadata
          asset: feeCalculation.feeAsset === 'GOLD' ? 'XAUT' : 'USDC', // Use actual token names
          amount: feeCalculation.feeAmount,
          snapshot_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to record swap fee collection:', error);
      }

      // Update transaction metadata to include fee information
      await supabase
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

    } catch (err) {
      console.error('Error recording swap fee collection:', err);
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
    baseFee: number;
    platformFee: number;
    totalFee: number;
    netAmount: number;
  } {
    const baseFee = (baseAmount * 50) / 10000; // 0.5% base fee
    const platformFee = (baseAmount * this.PLATFORM_FEE_BPS) / 10000; // 1% platform fee
    const totalFee = baseFee + platformFee;
    const netAmount = baseAmount - totalFee;

    return {
      baseFee: Number(baseFee.toFixed(6)),
      platformFee: Number(platformFee.toFixed(6)),
      totalFee: Number(totalFee.toFixed(6)),
      netAmount: Number(netAmount.toFixed(6))
    };
  }
}

export const swapFeeService = new SwapFeeService();