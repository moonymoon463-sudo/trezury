import { supabase } from "@/integrations/supabase/client";
import UniswapV3QuoterABI from "@/contracts/abis/UniswapV3Quoter.json";

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

export class DexAggregatorService {
  private static readonly UNISWAP_V3_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
  private static readonly UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  private static readonly TOKEN_ADDRESSES = {
    ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH mainnet
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC mainnet (corrected)
    XAUT: '0x68749665FF8D2d112Fa859AA293F07A622782F38', // Tether Gold mainnet
    TRZRY: '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B', // TRZRY Token
    BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' // WBTC mainnet
  };
  
  private static readonly POOL_FEES = {
    'USDC-ETH': 3000, // 0.3%
    'ETH-USDC': 3000, // 0.3%
    'USDC-XAUT': 3000, // 0.3%
    'XAUT-USDC': 3000, // 0.3%
    'USDC-TRZRY': 3000, // 0.3%
    'TRZRY-USDC': 3000, // 0.3%
    'XAUT-TRZRY': 3000, // 0.3%
    'TRZRY-XAUT': 3000, // 0.3%
    'BTC-ETH': 3000, // 0.3%
    'ETH-BTC': 3000, // 0.3%
    'BTC-USDC': 3000, // 0.3%
    'USDC-BTC': 3000, // 0.3%
    'BTC-XAUT': 10000, // 1.0% for less common pairs
    'XAUT-BTC': 10000, // 1.0%
    'BTC-TRZRY': 10000, // 1.0%
    'TRZRY-BTC': 10000 // 1.0%
  };

  static async getBestRoute(
    inputAsset: string,
    outputAsset: string,
    amount: number,
    slippage: number = 0.5,
    userAddress?: string
  ): Promise<DexRoute[]> {
    try {
      console.log(`🔍 Finding REAL DEX routes: ${amount} ${inputAsset} → ${outputAsset}`);
      const routes: DexRoute[] = [];
      
      // Get REAL Uniswap V3 quote via blockchain operations
      const uniswapRoute = await this.getUniswapV3Quote(inputAsset, outputAsset, amount, slippage, userAddress);
      if (uniswapRoute) {
        routes.push(uniswapRoute);
      }
      
      console.log(`✅ Found ${routes.length} REAL routes`);
      return routes.sort((a, b) => b.outputAmount - a.outputAmount);
      
    } catch (error) {
      console.error('❌ Error fetching REAL DEX routes:', error);
      return [];
    }
  }

  private static async getUniswapV3Quote(
    inputAsset: string,
    outputAsset: string,
    amount: number,
    slippage: number,
    userAddress?: string
  ): Promise<DexRoute | null> {
    try {
      console.log(`📊 Getting REAL Uniswap V3 quote: ${amount} ${inputAsset} → ${outputAsset}`);
      
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_uniswap_quote',
          inputAsset,
          outputAsset,
          amount,
          slippage,
          userAddress
        }
      });

      if (error || !data?.success) {
        console.error('❌ REAL Uniswap quote failed:', error || data?.error);
        return null;
      }

      console.log(`✅ REAL Uniswap quote: ${data.outputAmount} ${outputAsset} (${data.priceImpact}% impact)`);

      return {
        id: `uniswap-v3-${Date.now()}`,
        protocol: 'uniswap-v3',
        inputAsset,
        outputAsset,
        inputAmount: amount,
        outputAmount: data.outputAmount,
        priceImpact: data.priceImpact,
        gasEstimate: data.gasEstimate,
        route: [{
          protocol: 'uniswap-v3',
          poolFee: this.POOL_FEES[`${inputAsset}-${outputAsset}` as keyof typeof this.POOL_FEES] || 3000,
          tokenIn: this.TOKEN_ADDRESSES[inputAsset as keyof typeof this.TOKEN_ADDRESSES],
          tokenOut: this.TOKEN_ADDRESSES[outputAsset as keyof typeof this.TOKEN_ADDRESSES]
        }],
        confidence: 0.98
      };
    } catch (error) {
      console.error('❌ Error getting REAL Uniswap V3 quote:', error);
      return null;
    }
  }

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
      'uniswap-v3': basePrice * (1 + (Math.random() - 0.5) * 0.01),
      'sushiswap': basePrice * (1 + (Math.random() - 0.5) * 0.01),
      'curve': basePrice * (1 + (Math.random() - 0.5) * 0.01),
      'balancer': basePrice * (1 + (Math.random() - 0.5) * 0.01),
      '1inch': basePrice * (1 + (Math.random() - 0.5) * 0.01)
    };
  }

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
      console.log(`🔄 Executing REAL swap on ${route.protocol}: ${route.inputAmount} ${route.inputAsset} → ${route.outputAsset}`);
      console.log(`👤 User wallet: ${userAddress}, Quote ID: ${quoteId || 'none'}, Intent ID: ${intentId || 'none'}`);
      
      // Execute REAL Uniswap V3 swap through blockchain operations with user's wallet
      const { data: swapResult, error: swapError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'execute_uniswap_swap',
          inputAsset: route.inputAsset,
          outputAsset: route.outputAsset,
          amountIn: route.inputAmount,
          slippage: slippage,
          walletPassword: walletPassword,
          quoteId: quoteId,
          intentId: intentId, // Actual intent row ID
          idempotencyKey: idempotencyKey // Separate idempotency key for duplicate detection
        }
      });

      if (swapError || !swapResult?.success) {
        // Extract detailed error message from edge function response
        let errorMessage = 'Real swap execution failed';
        
        // If swapResult has error details (success: false case)
        if (swapResult?.error) {
          errorMessage = swapResult.error;
        }
        // If swapError has context (non-2xx status case)
        else if (swapError && typeof swapError === 'object' && 'context' in swapError) {
          const context = (swapError as any).context;
          if (context?.error) {
            errorMessage = context.error;
          } else if (context) {
            errorMessage = JSON.stringify(context);
          }
        }
        // Fallback to error message
        else if (swapError?.message) {
          errorMessage = swapError.message;
        }
        
        console.error(`❌ REAL ${route.protocol} swap failed:`, errorMessage);
        return {
          success: false,
          error: errorMessage,
          requiresImport: swapResult?.requiresImport || false,
          requiresRefund: swapResult?.requiresRefund || false,
          refundTxHash: swapResult?.refundTxHash
        };
      }

      console.log(`🎉 REAL ${route.protocol} swap completed:`, swapResult.txHash);
      console.log(`🏦 User wallet used: ${swapResult.userWallet}`);

      return { 
        success: true, 
        txHash: swapResult.txHash,
        gasFeePaidInTokens: swapResult.gasFeePaidInTokens,
        gasFeeInTokens: swapResult.gasFeeInTokens,
        adjustedInputAmount: swapResult.adjustedInputAmount,
        gasFeePaidByRelayer: swapResult.gasFeePaidByRelayer,
        relayFeeInOutputTokens: swapResult.relayFeeInOutputTokens,
        relayFeeUsd: swapResult.relayFeeUsd,
        netOutputAmount: swapResult.netOutputAmount,
        outputAmount: swapResult.outputAmount,
        relayerAddress: swapResult.relayerAddress,
        transactionId: swapResult.transactionId,
        requiresReconciliation: swapResult.requiresReconciliation || false
      };
      
      
    } catch (error) {
      console.error('❌ Error executing REAL swap:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Real swap execution failed' 
      };
    }
  }
}