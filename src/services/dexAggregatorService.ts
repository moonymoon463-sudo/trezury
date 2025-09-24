import { supabase } from "@/integrations/supabase/client";

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
  private static readonly SUPPORTED_PROTOCOLS = [
    'uniswap-v3',
    'uniswap-v2', 
    'sushiswap',
    'curve',
    'balancer',
    '1inch',
    'paraswap'
  ];

  static async getBestRoute(
    inputAsset: string,
    outputAsset: string,
    amount: number,
    slippage: number = 0.5
  ): Promise<DexRoute[]> {
    try {
      // Call external DEX aggregator APIs
      const routes: DexRoute[] = [];
      
      // Mock implementation for demo - replace with actual API calls
      const mockRoutes = [
        {
          id: `route-${Date.now()}-1`,
          protocol: '1inch',
          inputAsset,
          outputAsset,
          inputAmount: amount,
          outputAmount: amount * 0.998, // 0.2% slippage
          priceImpact: 0.15,
          gasEstimate: 180000,
          route: [
            { protocol: 'uniswap-v3', poolFee: 0.3 },
            { protocol: 'curve', poolAddress: '0x...' }
          ],
          confidence: 0.95
        },
        {
          id: `route-${Date.now()}-2`,
          protocol: 'paraswap',
          inputAsset,
          outputAsset,
          inputAmount: amount,
          outputAmount: amount * 0.9965, // 0.35% slippage
          priceImpact: 0.22,
          gasEstimate: 220000,
          route: [
            { protocol: 'sushiswap', poolFee: 0.25 }
          ],
          confidence: 0.92
        }
      ];
      
      routes.push(...mockRoutes);
      
      // Sort by output amount (best rate first)
      return routes.sort((a, b) => b.outputAmount - a.outputAmount);
      
    } catch (error) {
      console.error('Error fetching DEX routes:', error);
      return [];
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
      // Execute swap through blockchain operations
      const { data: swapResult, error: swapError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'execute_swap',
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