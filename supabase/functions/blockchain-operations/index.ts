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
  operation: 'transfer' | 'collect_fee';
  from?: string;
  to?: string;
  amount: number;
  asset: 'USDC' | 'XAUT';
  userId: string;
  transactionId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, from, to, amount, asset, userId, transactionId }: BlockchainOperationRequest = await req.json();

    console.log(`Processing blockchain operation: ${operation}`);

    // Get platform wallet private key from environment
    const platformPrivateKey = Deno.env.get('PLATFORM_PRIVATE_KEY');
    
    if (!platformPrivateKey) {
      throw new Error('Platform private key not configured');
    }

    // For demo purposes, simulate blockchain operations
    // In production, you would use ethers.js here with the actual private key
    
    const txHash = generateTransactionHash();
    const platformWallet = '0x742d35Cc6634C0532925a3b8D69B8e6b4f5c5a4c';
    
    let result = {};

    switch (operation) {
      case 'transfer':
        result = {
          success: true,
          hash: txHash,
          from: from || platformWallet,
          to: to || platformWallet,
          amount,
          asset,
          status: 'confirmed',
          blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
          timestamp: new Date().toISOString()
        };
        break;

      case 'collect_fee':
        // Record fee collection
        const { error: feeError } = await supabase
          .from('balance_snapshots')
          .insert({
            user_id: userId,
            asset,
            amount: -amount, // Negative for fee deduction
            snapshot_at: new Date().toISOString()
          });

        if (feeError) {
          console.error('Fee recording error:', feeError);
        }

        // Update transaction metadata
        if (transactionId) {
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              metadata: {
                platformFeeCollected: true,
                feeTransactionHash: txHash,
                feeCollectedAt: new Date().toISOString()
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
          to: platformWallet,
          amount,
          asset,
          status: 'confirmed',
          blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
          timestamp: new Date().toISOString()
        };
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Blockchain operation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
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