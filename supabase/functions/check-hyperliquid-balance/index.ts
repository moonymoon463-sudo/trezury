import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();

    if (!address) {
      throw new Error('Address is required');
    }

    const response = await fetch(`${HYPERLIQUID_API}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: address
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Account not funded yet
        return new Response(
          JSON.stringify({
            balance: '0',
            equity: '0',
            accountValue: '0',
            withdrawable: '0',
            marginUsed: '0'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      throw new Error(`Hyperliquid API error: ${response.statusText}`);
    }

    const accountState = await response.json();
    const summary = accountState.crossMarginSummary || accountState.marginSummary;

    return new Response(
      JSON.stringify({
        balance: summary.totalRawUsd || '0',
        equity: summary.accountValue || '0',
        accountValue: summary.accountValue || '0',
        withdrawable: accountState.withdrawable || '0',
        marginUsed: summary.totalMarginUsed || '0',
        positionValue: summary.totalNtlPos || '0'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Check Hyperliquid balance error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
