import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { dydxAddress } = await req.json();

    if (!dydxAddress || !dydxAddress.startsWith('dydx1')) {
      return new Response(
        JSON.stringify({ error: 'Invalid dYdX address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[check-dydx-balance] Checking balance for:', dydxAddress);

    // Query dYdX mainnet indexer for subaccount balance
    // Subaccount 0 is default for trading
    const indexerUrl = `https://indexer.dydx.trade/v4/addresses/${dydxAddress}/subaccountNumber/0`;
    
    const response = await fetch(indexerUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // If 404, account doesn't exist yet (no deposits)
      if (response.status === 404) {
        return new Response(
          JSON.stringify({
            usdc: '0',
            equity: '0',
            freeCollateral: '0',
            status: 'unfunded',
            exists: false
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Indexer request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract balance data from subaccount
    const subaccount = data.subaccount || {};
    const freeCollateral = parseFloat(subaccount.freeCollateral || '0');
    const equity = parseFloat(subaccount.equity || '0');

    console.log('[check-dydx-balance] Balance:', {
      address: dydxAddress,
      freeCollateral,
      equity
    });

    return new Response(
      JSON.stringify({
        usdc: freeCollateral.toFixed(2),
        equity: equity.toFixed(2),
        freeCollateral: freeCollateral.toFixed(2),
        status: freeCollateral > 0 ? 'funded' : 'pending',
        exists: true,
        raw: subaccount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-dydx-balance] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        usdc: '0',
        status: 'error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
