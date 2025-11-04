import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { operation, ...params } = await req.json();
    console.log(`[hyperliquid-bridge] Operation: ${operation}`, params);

    switch (operation) {
      case 'get_quote':
        return new Response(JSON.stringify(await getQuote(params)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      case 'execute_bridge':
        return new Response(JSON.stringify(await executeBridge(supabaseClient, user.id, params)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      case 'check_status':
        return new Response(JSON.stringify(await checkStatus(supabaseClient, params.bridgeId)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error('[hyperliquid-bridge] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getQuote(params: any) {
  const { fromChain, toChain, token, amount, provider, destinationAddress } = params;
  
  console.log('[hyperliquid-bridge] Getting quote:', { fromChain, toChain, amount, provider });

  // Calculate fees based on provider
  const feeRates: Record<string, number> = {
    across: 0.003, // 0.3%
    stargate: 0.002, // 0.2%
    native: 0.001 // 0.1%
  };

  const feeRate = feeRates[provider] || 0.005;
  const fee = amount * feeRate;
  const estimatedOutput = amount - fee;

  // Estimate time
  const timeEstimates: Record<string, Record<string, string>> = {
    across: {
      ethereum: '30s - 2min',
      arbitrum: '30s - 1min',
      default: '1 - 3min'
    },
    stargate: {
      ethereum: '1 - 5min',
      default: '2 - 5min'
    },
    native: {
      ethereum: '5 - 10min',
      default: '5 - 10min'
    }
  };

  const estimatedTime = timeEstimates[provider]?.[fromChain] || timeEstimates[provider]?.default || '5 - 10min';

  return {
    provider,
    fromChain,
    toChain,
    inputAmount: amount,
    estimatedOutput,
    fee,
    estimatedTime,
    route: {
      destinationAddress,
      token,
      confirmations: provider === 'native' ? 12 : 1
    }
  };
}

async function executeBridge(supabaseClient: any, userId: string, params: any) {
  const { quote, sourceWalletAddress } = params;
  
  console.log('[hyperliquid-bridge] Executing bridge:', { 
    userId, 
    quote,
    sourceWallet: sourceWalletAddress,
    destinationChain: 'Hyperliquid L1'
  });

  // Validate destination is Hyperliquid L1
  if (quote.toChain !== 'hyperliquid') {
    throw new Error('Invalid destination chain. Must bridge to Hyperliquid L1.');
  }

  // Create bridge transaction record
  const { data: bridgeTransaction, error: insertError } = await supabaseClient
    .from('bridge_transactions')
    .insert({
      user_id: userId,
      source_chain: quote.fromChain,
      destination_chain: 'hyperliquid',
      bridge_provider: quote.provider,
      amount: quote.inputAmount,
      token: 'USDC',
      status: 'pending',
      estimated_completion: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      metadata: {
        quote,
        sourceWalletAddress,
        destinationAddress: quote.route.destinationAddress,
        destinationChain: 'Hyperliquid L1',
        estimatedOutput: quote.estimatedOutput,
        fee: quote.fee
      }
    })
    .select()
    .single();

  if (insertError) {
    console.error('[hyperliquid-bridge] Insert error:', insertError);
    throw insertError;
  }

  // In production, this would interact with actual bridge APIs
  // For now, we return a mock response
  const mockTxHash = `0x${Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)).join('')}`;

  // Update with source tx hash
  await supabaseClient
    .from('bridge_transactions')
    .update({
      source_tx_hash: mockTxHash,
      status: 'processing'
    })
    .eq('id', bridgeTransaction.id);

  return {
    success: true,
    txHash: mockTxHash,
    bridgeId: bridgeTransaction.id,
    estimatedCompletion: bridgeTransaction.estimated_completion
  };
}

async function checkStatus(supabaseClient: any, bridgeId: string) {
  const { data: bridge, error } = await supabaseClient
    .from('bridge_transactions')
    .select('*')
    .eq('id', bridgeId)
    .single();

  if (error) throw error;

  return {
    status: bridge.status,
    txHash: bridge.source_tx_hash,
    destinationTxHash: bridge.destination_tx_hash,
    estimatedCompletion: bridge.estimated_completion
  };
}
