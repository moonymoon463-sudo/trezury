import { supabase } from "@/integrations/supabase/client";
import { ethers } from "ethers";
import { zeroXSwapService } from "./zeroXSwapService";

export interface DexRoute {
  id: string;
  protocol: string;
  inputAsset: string;
  outputAsset: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  gasEstimate: number;
  route: any[];
  confidence: number;
}

export interface ArbitrageOpportunity {
  id: string;
  asset: string;
  buyProtocol: string;
  sellProtocol: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercent: number;
  volume: number;
  gasRequired: number;
  netProfit: number;
  confidence: number;
  expiresAt: Date;
}

/**
 * DEX Aggregator Service using 0x Protocol exclusively
 * 
 * 0x aggregates 100+ DEX sources including:
 * - Uniswap V2, V3, V4
 * - SushiSwap, Curve, Balancer
 * - 1inch, and 95+ more protocols
 * 
 * This provides better prices than any single DEX.
 */
export class DexAggregatorService {
  /**
   * Get best swap routes using 0x Protocol aggregator
   */
  static async getBestRoute(
    inputAsset: string,
    outputAsset: string,
    amount: number,
    slippage: number = 0.5,
    userAddress?: string
  ): Promise<DexRoute[]> {
    try {
      console.log(`🔍 Finding best routes via 0x aggregator: ${amount} ${inputAsset} → ${outputAsset}`);
      
      // Get quote from 0x (which aggregates 100+ DEXs including Uniswap)
      const inputDecimals = zeroXSwapService.getTokenDecimals(inputAsset);
      const sellAmount = ethers.parseUnits(amount.toString(), inputDecimals).toString();
      
      const quote = await zeroXSwapService.getQuote(
        inputAsset,
        outputAsset,
        sellAmount,
        userAddress || '0x0000000000000000000000000000000000000000'
      );
      
      const outputDecimals = zeroXSwapService.getTokenDecimals(outputAsset);
      const outputAmount = parseFloat(ethers.formatUnits(quote.buyAmount, outputDecimals));
      
      console.log(`✅ 0x quote: ${outputAmount} ${outputAsset} via ${quote.sources.length} sources`);
      console.log(`📊 Price: ${quote.price}, Guaranteed: ${quote.guaranteedPrice}`);
      
      return [{
        id: '0x-aggregated',
        protocol: '0x',
        inputAsset,
        outputAsset,
        inputAmount: amount,
        outputAmount,
        priceImpact: 0.5, // 0x handles this internally
        gasEstimate: parseInt(quote.estimatedGas),
        route: quote.sources,
        confidence: 95
      }];
      
    } catch (error) {
      console.error('❌ Error fetching 0x routes:', error);
      return [];
    }
  }

  /**
   * Find arbitrage opportunities across protocols
   */
  static async findArbitrageOpportunities(
    assets: string[] = ['USDC', 'USDT', 'DAI', 'XAUT']
  ): Promise<ArbitrageOpportunity[]> {
    try {
      const opportunities: ArbitrageOpportunity[] = [];
      
      for (const asset of assets) {
        // Check price differences across protocols
        const prices = await this.getPricesAcrossProtocols(asset);
        
        const sortedPrices = Object.entries(prices).sort(([,a], [,b]) => a - b);
        const buyProtocol = sortedPrices[0];
        const sellProtocol = sortedPrices[sortedPrices.length - 1];
        
        const priceDiff = sellProtocol[1] - buyProtocol[1];
        const profitPercent = (priceDiff / buyProtocol[1]) * 100;
        
        // Only include if profit > 0.5%
        if (profitPercent > 0.5) {
          opportunities.push({
            id: `arb-${asset}-${Date.now()}`,
            asset,
            buyProtocol: buyProtocol[0],
            sellProtocol: sellProtocol[0],
            buyPrice: buyProtocol[1],
            sellPrice: sellProtocol[1],
            profit: priceDiff,
            profitPercent,
            volume: 10000, // $10k max volume
            gasRequired: 400000,
            netProfit: (priceDiff * 10000) - (400000 * 0.00002), // Rough gas cost
            confidence: 0.85,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
          });
        }
      }
      
      return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
      
    } catch (error) {
      console.error('Error finding arbitrage opportunities:', error);
      return [];
    }
  }

  private static async getPricesAcrossProtocols(asset: string): Promise<Record<string, number>> {
    // Mock implementation - replace with actual price feeds
    const basePrice = Math.random() * 100 + 50; // Random price between $50-150
    
    return {
      '0x-aggregated': basePrice * (1 + (Math.random() - 0.5) * 0.01),
      'curve': basePrice * (1 + (Math.random() - 0.5) * 0.01),
      'sushiswap': basePrice * (1 + (Math.random() - 0.5) * 0.01),
      'balancer': basePrice * (1 + (Math.random() - 0.5) * 0.01),
      '1inch': basePrice * (1 + (Math.random() - 0.5) * 0.01)
    };
  }

  /**
   * Execute swap using 0x Protocol
   * Delegates to swapService which uses execute_0x_swap
   */
  static async executeOptimalSwap(
    route: DexRoute,
    userAddress: string,
    slippage: number = 0.5,
    walletPassword?: string,
    quoteId?: string,
    intentId?: string,
    idempotencyKey?: string
  ): Promise<{ 
    success: boolean; 
    txHash?: string; 
    error?: string; 
    gasFeePaidInTokens?: boolean; 
    gasFeeInTokens?: number; 
    adjustedInputAmount?: number; 
    requiresImport?: boolean;
    gasFeePaidByRelayer?: boolean;
    relayFeeInOutputTokens?: string;
    relayFeeUsd?: string;
    netOutputAmount?: string;
    outputAmount?: string;
    relayerAddress?: string;
    requiresReconciliation?: boolean;
    requiresRefund?: boolean;
    refundTxHash?: string;
    transactionId?: string;
  }> {
    try {
      console.log(`🔄 Executing 0x swap: ${route.inputAmount} ${route.inputAsset} → ${route.outputAsset}`);
      console.log(`👤 User wallet: ${userAddress}, Quote ID: ${quoteId || 'none'}, Intent ID: ${intentId || 'none'}`);
      
      if (!quoteId) {
        throw new Error('Quote ID is required for swap execution');
      }
      
      // Execute via swapService which uses execute_0x_swap operation
      const { swapService } = await import('./swapService');
      const result = await swapService.executeSwap(
        quoteId, 
        userAddress, // userId (will be resolved via auth)
        walletPassword || ''
      );
      
      if (!result.success) {
        console.error(`❌ 0x swap failed:`, result.error);
        return {
          success: false,
          error: result.error || '0x swap execution failed',
          requiresImport: false
        };
      }

      console.log(`🎉 0x swap completed:`, result.txHash);

      return { 
        success: true, 
        txHash: result.txHash
      };
      
    } catch (error) {
      console.error('❌ Error executing 0x swap:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '0x swap execution failed' 
      };
    }
  }
}
