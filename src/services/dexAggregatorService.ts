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
    USDC: '0xA0b86a33E6481b7C88047F0fE3BDD78Db8DC820b',
    XAUT: '0x68749665FF8D2d112Fa859AA293F07A622782F38'
  };
  
  private static readonly POOL_FEES = {
    'USDC-XAUT': 3000, // 0.3%
    'XAUT-USDC': 3000  // 0.3%
  };

  static async getBestRoute(
    inputAsset: string,
    outputAsset: string,
    amount: number,
    slippage: number = 0.5,
    userAddress?: string
  ): Promise<DexRoute[]> {
    try {
      const routes: DexRoute[] = [];
      
      // Get Uniswap V3 quote via blockchain operations
      const uniswapRoute = await this.getUniswapV3Quote(inputAsset, outputAsset, amount, slippage, userAddress);
      if (uniswapRoute) {
        routes.push(uniswapRoute);
      }
      
      return routes.sort((a, b) => b.outputAmount - a.outputAmount);
      
    } catch (error) {
      console.error('Error fetching DEX routes:', error);
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
        console.error('Uniswap quote failed:', error || data?.error);
        return null;
      }

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
      console.error('Error getting Uniswap V3 quote:', error);
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
    slippage: number = 0.5
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Execute real Uniswap V3 swap through blockchain operations
      const { data: swapResult, error: swapError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'execute_uniswap_swap',
          inputAsset: route.inputAsset,
          outputAsset: route.outputAsset,
          amount: route.inputAmount,
          userAddress: userAddress,
          route: route,
          slippage: slippage
        }
      });

      if (swapError || !swapResult?.success) {
        return {
          success: false,
          error: swapResult?.error || swapError?.message || 'Swap execution failed'
        };
      }

      return { 
        success: true, 
        txHash: swapResult.txHash 
      };
      
    } catch (error) {
      console.error('Error executing swap:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}