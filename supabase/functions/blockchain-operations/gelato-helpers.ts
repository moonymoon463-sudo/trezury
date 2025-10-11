import { GelatoRelay, SponsoredCallERC2771Request } from "@gelatonetwork/relay-sdk";
import { ethers } from "https://esm.sh/ethers@6.13.2";

const relay = new GelatoRelay();

/**
 * Estimate Gelato relay fee for a swap
 * Fee is deducted from output tokens in SyncFee mode
 */
export async function estimateGelatoFee(
  provider: ethers.Provider,
  sellToken: string,
  buyToken: string,
  estimatedGas: bigint
): Promise<{ feeWei: bigint; feeInBuyToken: bigint }> {
  try {
    // Add 30% buffer to estimated gas
    const gasWithBuffer = (estimatedGas * 130n) / 100n;
    
    // Get current gas price from provider
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('50', 'gwei'); // Fallback
    
    // Calculate fee in wei
    const feeWei = gasWithBuffer * gasPrice;
    
    // For SyncFee mode, convert to buy token amount
    // Simplified: assume 1 ETH = $2500, use market price for buy token
    const ethPrice = 2500; // Simplified - in production use oracle
    const buyTokenPrice = await getTokenPriceUSD(buyToken);
    
    const feeUSD = Number(ethers.formatEther(feeWei)) * ethPrice;
    const feeInBuyToken = BigInt(Math.ceil((feeUSD / buyTokenPrice) * 1e18));
    
    console.log(`💰 Gelato fee estimate: ${ethers.formatEther(feeWei)} ETH (~$${feeUSD.toFixed(2)}) = ${ethers.formatEther(feeInBuyToken)} ${buyToken}`);
    
    return { feeWei, feeInBuyToken };
  } catch (error) {
    console.error('Failed to estimate Gelato fee:', error);
    // Conservative fallback: 0.5% of output
    return { feeWei: ethers.parseEther('0.003'), feeInBuyToken: 0n };
  }
}

/**
 * Submit transaction to Gelato Relay network
 */
export async function submitToGelatoRelay(
  contractAddress: string,
  callData: string,
  userAddress: string,
  mode: 'syncfee' | 'sponsored',
  feeToken?: string,
  sponsorApiKey?: string
): Promise<{ taskId: string; success: boolean; error?: string }> {
  try {
    console.log(`⚡ Submitting to Gelato Relay (${mode} mode)...`);
    
    if (mode === 'syncfee') {
      // SyncFee: User pays fee from output tokens
      const request: SponsoredCallERC2771Request = {
        chainId: BigInt(1), // Ethereum mainnet
        target: contractAddress,
        data: callData,
        user: userAddress,
        feeToken: feeToken!, // Output token address
        isRelayContext: true
      };
      
      const relayApiKey = Deno.env.get('GELATO_RELAY_API_KEY');
      if (!relayApiKey) {
        throw new Error('GELATO_RELAY_API_KEY not configured');
      }
      
      const response = await relay.sponsoredCallERC2771(
        request,
        relayApiKey
      );
      
      console.log(`✅ Gelato task created: ${response.taskId}`);
      return {
        taskId: response.taskId,
        success: true
      };
    } else {
      // Sponsored: Platform pays all gas
      if (!sponsorApiKey) {
        sponsorApiKey = Deno.env.get('GELATO_SPONSOR_API_KEY');
      }
      
      if (!sponsorApiKey) {
        throw new Error('GELATO_SPONSOR_API_KEY not configured for sponsored mode');
      }
      
      const response = await relay.sponsoredCall(
        {
          chainId: BigInt(1),
          target: contractAddress,
          data: callData
        },
        sponsorApiKey
      );
      
      console.log(`✅ Gelato sponsored task created: ${response.taskId}`);
      return {
        taskId: response.taskId,
        success: true
      };
    }
  } catch (error) {
    console.error('❌ Gelato relay submission failed:', error);
    return {
      taskId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Gelato relay failed'
    };
  }
}

/**
 * Check Gelato task status
 */
export async function checkGelatoTaskStatus(taskId: string): Promise<{
  state: string;
  transactionHash?: string;
  blockNumber?: number;
  executionDate?: string;
}> {
  try {
    const status = await relay.getTaskStatus(taskId);
    
    return {
      state: status.taskState,
      transactionHash: status.transactionHash,
      blockNumber: status.blockNumber,
      executionDate: status.executionDate
    };
  } catch (error) {
    console.error('Failed to get Gelato task status:', error);
    return { state: 'Unknown' };
  }
}

/**
 * Get token price in USD (simplified)
 * In production, use Chainlink or CoinGecko API
 */
async function getTokenPriceUSD(tokenAddress: string): Promise<number> {
  const TOKEN_PRICES: Record<string, number> = {
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 1.0,  // USDC
    '0x68749665FF8D2d112Fa859AA293F07A622782F38': 4000, // XAUT (gold)
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 1.0,  // USDT
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 65000 // WBTC
  };
  
  return TOKEN_PRICES[tokenAddress] || 1.0;
}
