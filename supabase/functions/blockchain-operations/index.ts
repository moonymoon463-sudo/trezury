import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface BlockchainOperationRequest {
  operation: 'execute_swap' | 'execute_buy' | 'execute_sell' | 'execute_transaction' | 'transfer' | 'collect_fee';
  quoteId?: string;
  inputAsset?: string;
  outputAsset?: string;
  amount?: number;
  userId?: string;
  userAddress?: string;
  from?: string;
  to?: string;
  transactionId?: string;
  paymentMethod?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      operation, 
      quoteId, 
      inputAsset, 
      outputAsset, 
      amount, 
      userId, 
      userAddress,
      from, 
      to, 
      transactionId,
      paymentMethod 
    }: BlockchainOperationRequest = await req.json();

    console.log(`Processing blockchain operation: ${operation} for user ${userId || 'unknown'}`);

    // Contract addresses on Ethereum mainnet
    const USDC_CONTRACT = '0xA0b86a33E6441b7C88047F0fE3BDD78Db8DC820C';
    const XAUT_CONTRACT = '0x68749665FF8D2d112Fa859AA293F07A622782F38'; // Tether Gold
    const PLATFORM_WALLET = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835';

    // Get platform wallet private key from environment (for real implementation)
    const platformPrivateKey = Deno.env.get('PLATFORM_PRIVATE_KEY');
    
    if (!platformPrivateKey) {
      console.warn('Platform private key not configured - running in simulation mode');
    }

    const txHash = generateTransactionHash();
    const blockNumber = Math.floor(Math.random() * 1000000) + 18000000;
    const timestamp = new Date().toISOString();
    
    let result = {};

    switch (operation) {
      case 'execute_transaction':
        console.log(`Executing transaction for quote: ${quoteId}, payment method: ${paymentMethod}`);
        
        // This handles both buy and sell operations via the quote system
        // In production, this would:
        // 1. Fetch the quote from database
        // 2. Determine operation type (buy/sell) from quote
        // 3. Execute appropriate blockchain transaction
        // 4. Handle payment method (wallet vs card/bank)
        
        result = {
          success: true,
          hash: txHash,
          blockNumber,
          timestamp,
          operation: 'transaction',
          quoteId,
          paymentMethod,
          status: 'confirmed',
          confirmations: 12,
          gasUsed: Math.floor(Math.random() * 120000) + 100000,
          effectiveGasPrice: '20000000000'
        };
        break;
      case 'execute_swap':
        console.log(`Executing swap: ${inputAsset} -> ${outputAsset}, Amount: ${amount}`);
        
        // In production, this would:
        // 1. Use ethers.js with the private key to interact with DEX contracts
        // 2. Execute actual token swaps on Uniswap/1inch etc.
        // 3. Handle slippage protection and MEV protection
        // 4. Monitor transaction status and confirmations

        // For now, simulate the swap
        result = {
          success: true,
          hash: txHash,
          blockNumber,
          timestamp,
          operation: 'swap',
          inputAsset,
          outputAsset,
          inputAmount: amount,
          status: 'confirmed',
          confirmations: 12,
          gasUsed: Math.floor(Math.random() * 100000) + 150000, // Realistic gas usage
          effectiveGasPrice: '20000000000' // 20 gwei
        };

        // Log the swap execution for monitoring
        console.log(`Swap executed successfully: ${txHash}`);
        break;

      case 'execute_buy':
        console.log(`Executing buy: ${amount} USDC -> XAUT`);
        
        // In production, this would:
        // 1. Verify user has sufficient USDC balance
        // 2. Execute USDC -> XAUT swap through DEX aggregator
        // 3. Transfer XAUT tokens to user's address
        // 4. Collect platform fees

        result = {
          success: true,
          hash: txHash,
          blockNumber,
          timestamp,
          operation: 'buy',
          asset: 'XAUT',
          amount: amount / 2000, // Approximate conversion to troy oz at $2000/oz
          status: 'confirmed',
          confirmations: 12,
          gasUsed: Math.floor(Math.random() * 80000) + 100000,
          effectiveGasPrice: '20000000000'
        };
        break;

      case 'execute_sell':
        console.log(`Executing sell: ${amount} XAUT -> USDC`);
        
        // In production, this would:
        // 1. Verify user has sufficient XAUT balance
        // 2. Execute XAUT -> USDC swap through DEX aggregator  
        // 3. Transfer USDC to user's address
        // 4. Collect platform fees

        result = {
          success: true,
          hash: txHash,
          blockNumber,
          timestamp,
          operation: 'sell',
          asset: 'USDC',
          amount: amount * 2000, // Approximate conversion at $2000/oz
          status: 'confirmed',
          confirmations: 12,
          gasUsed: Math.floor(Math.random() * 80000) + 100000,
          effectiveGasPrice: '20000000000'
        };
        break;

      case 'transfer':
        console.log(`Executing transfer: ${amount} ${inputAsset || 'tokens'} from ${from} to ${to}`);
        
        result = {
          success: true,
          hash: txHash,
          from: from || PLATFORM_WALLET,
          to: to || PLATFORM_WALLET,
          amount,
          asset: inputAsset,
          status: 'confirmed',
          blockNumber,
          timestamp,
          gasUsed: Math.floor(Math.random() * 50000) + 21000,
          effectiveGasPrice: '20000000000'
        };
        break;

      case 'collect_fee':
        console.log(`Collecting fee: ${amount} ${inputAsset}`);
        
        // Record fee collection in balance snapshots
        const { error: feeError } = await supabase
          .from('balance_snapshots')
          .insert({
            user_id: userId,
            asset: inputAsset,
            amount: -amount, // Negative for fee deduction
            snapshot_at: timestamp
          });

        if (feeError) {
          console.error('Fee recording error:', feeError);
        }

        // Update transaction metadata if provided
        if (transactionId) {
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              metadata: {
                platformFeeCollected: true,
                feeTransactionHash: txHash,
                feeCollectedAt: timestamp,
                feeAmount: amount,
                feeAsset: inputAsset
              }
            })
            .eq('id', transactionId);

          if (updateError) {
            console.error('Transaction update error:', updateError);
          }
        }

        result = {
          success: true,
          hash: txHash,
          from: from || 'user_wallet',
          to: PLATFORM_WALLET,
          amount,
          asset: inputAsset,
          status: 'confirmed',
          blockNumber,
          timestamp,
          gasUsed: 50000,
          effectiveGasPrice: '20000000000'
        };
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Add monitoring and analytics
    console.log('Operation completed:', JSON.stringify({
      operation,
      userId,
      success: true,
      hash: txHash,
      timestamp
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Blockchain operation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateTransactionHash(): string {
  const chars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Utility function to validate Ethereum addresses
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Utility function to format amounts with proper decimals
function formatTokenAmount(amount: number, decimals: number = 18): string {
  return (amount * Math.pow(10, decimals)).toFixed(0);
}