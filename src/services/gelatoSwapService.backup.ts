import { GelatoRelay } from "@gelatonetwork/relay-sdk";
import { supabase } from "@/integrations/supabase/client";

interface ZeroXQuote {
  to: string;
  data: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  sellAmount: string;
  buyAmount: string;
  estimatedGas: string;
}

interface GelatoFeeEstimate {
  gelatoFeeInTokens: number;
  gelatoFeeUSD: number;
  netOutputAmount: number;
  totalCostPercent: number;
}

interface GelatoSwapResult {
  success: boolean;
  taskId?: string;
  txHash?: string;
  error?: string;
  intentId?: string;
}

/**
 * Service for executing gasless swaps using Gelato Relay
 */
class GelatoSwapService {
  private relay = new GelatoRelay();
  private readonly POLL_INTERVAL_MS = 5000; // 5 seconds
  private readonly MAX_POLL_ATTEMPTS = 60; // 5 minute timeout

  /**
   * Estimate cost for gasless swap
   * Shows user how much Gelato fee will be deducted from output
   */
  async estimateGaslessSwapCost(
    quote: ZeroXQuote,
    outputAsset: string
  ): Promise<GelatoFeeEstimate> {
    try {
      // Estimate Gelato fee via backend
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'estimate_gelato_fee',
          quote,
          outputAsset
        }
      });

      if (error) {
        console.error('Gelato fee estimation error:', error);
        // Conservative fallback: 0.5% of output
        const outputAmount = parseFloat(quote.buyAmount) / 1e18;
        const feeAmount = outputAmount * 0.005;
        return {
          gelatoFeeInTokens: feeAmount,
          gelatoFeeUSD: feeAmount, // Simplified
          netOutputAmount: outputAmount - feeAmount,
          totalCostPercent: 0.5
        };
      }

      return {
        gelatoFeeInTokens: data.feeInTokens,
        gelatoFeeUSD: data.feeUSD,
        netOutputAmount: data.netOutput,
        totalCostPercent: data.costPercent
      };
    } catch (error) {
      console.error('Failed to estimate Gelato cost:', error);
      const outputAmount = parseFloat(quote.buyAmount) / 1e18;
      const feeAmount = outputAmount * 0.005;
      return {
        gelatoFeeInTokens: feeAmount,
        gelatoFeeUSD: feeAmount,
        netOutputAmount: outputAmount - feeAmount,
        totalCostPercent: 0.5
      };
    }
  }

  /**
   * Execute gasless swap via Gelato Relay
   * No ETH needed - fee deducted from output tokens
   */
  async executeGaslessSwap(
    quote: ZeroXQuote,
    inputAsset: string,
    outputAsset: string,
    userAddress: string,
    quoteId: string,
    intentId: string,
    mode: 'syncfee' | 'sponsored' = 'syncfee'
  ): Promise<GelatoSwapResult> {
    try {
      console.log('⚡ Starting Gelato gasless swap...');

      // Submit to Gelato via backend edge function
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'execute_gelato_swap',
          mode,
          quote,
          inputAsset,
          outputAsset,
          userAddress,
          quoteId,
          intentId
        }
      });

      if (error || !data?.success) {
        return {
          success: false,
          error: error?.message || data?.error || 'Gelato relay submission failed',
          intentId
        };
      }

      const taskId = data.taskId;
      console.log(`⚡ Gelato task created: ${taskId}`);

      // Poll for task completion
      return await this.waitForGelatoCompletion(taskId, intentId);
    } catch (error) {
      console.error('Gelato swap error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gelato swap failed',
        intentId
      };
    }
  }

  /**
   * Poll Gelato task status until completion
   */
  private async waitForGelatoCompletion(taskId: string, intentId: string): Promise<GelatoSwapResult> {
    let attempts = 0;

    while (attempts < this.MAX_POLL_ATTEMPTS) {
      try {
        const status = await this.relay.getTaskStatus(taskId);
        console.log(`⚡ Gelato task ${taskId} status: ${status.taskState}`);

        if (status.taskState === 'ExecSuccess') {
          console.log(`✅ Gelato swap successful! Tx: ${status.transactionHash}`);
          return {
            success: true,
            taskId,
            txHash: status.transactionHash,
            intentId
          };
        }

        if (status.taskState === 'Cancelled' || status.taskState === 'ExecReverted') {
          console.error(`❌ Gelato task ${status.taskState}`);
          return {
            success: false,
            error: `Gelato task ${status.taskState}. Transaction reverted on-chain.`,
            taskId,
            intentId
          };
        }

        // Still pending/processing
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
        attempts++;
      } catch (error) {
        console.error('Error checking Gelato status:', error);
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
        attempts++;
      }
    }

    console.warn('⚠️ Gelato task polling timeout');
    return {
      success: false,
      error: 'Gelato transaction timeout. Check Gelato dashboard for status.',
      taskId,
      intentId
    };
  }

  /**
   * Get Gelato task status directly
   */
  async getTaskStatus(taskId: string) {
    try {
      return await this.relay.getTaskStatus(taskId);
    } catch (error) {
      console.error('Failed to get task status:', error);
      return null;
    }
  }
}

export const gelatoSwapService = new GelatoSwapService();
export type { GelatoFeeEstimate, GelatoSwapResult };
