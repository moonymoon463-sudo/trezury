import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    
    console.log(`[01-market-data] Action: ${action}`, params);

    switch (action) {
      case 'getMarkets': {
        const response = await fetch('https://api.01.xyz/v1/markets', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Markets API error: ${response.status}`);
        }

        const markets = await response.json();
        
        return new Response(
          JSON.stringify({ 
            ok: true, 
            data: markets 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      case 'getOrderbook': {
        const { symbol, depth = 20 } = params;
        
        if (!symbol) {
          throw new Error('Symbol is required');
        }

        const response = await fetch(`https://api.01.xyz/v1/orderbook/${symbol}?depth=${depth}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Orderbook API error: ${response.status}`);
        }

        const orderbook = await response.json();
        
        return new Response(
          JSON.stringify({ 
            ok: true, 
            data: orderbook 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      case 'getTrades': {
        const { symbol, limit = 50 } = params;
        
        if (!symbol) {
          throw new Error('Symbol is required');
        }

        const response = await fetch(`https://api.01.xyz/v1/trades/${symbol}?limit=${limit}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Trades API error: ${response.status}`);
        }

        const trades = await response.json();
        
        return new Response(
          JSON.stringify({ 
            ok: true, 
            data: trades 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      case 'getFundingRate': {
        const { symbol } = params;
        
        if (!symbol) {
          throw new Error('Symbol is required');
        }

        const response = await fetch(`https://api.01.xyz/v1/funding/${symbol}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Funding API error: ${response.status}`);
        }

        const funding = await response.json();
        
        return new Response(
          JSON.stringify({ 
            ok: true, 
            data: funding 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      case 'getCandles': {
        const { symbol, interval = '1h', limit = 100 } = params;
        
        if (!symbol) {
          throw new Error('Symbol is required');
        }

        const response = await fetch(
          `https://api.01.xyz/v1/candles/${symbol}?interval=${interval}&limit=${limit}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Candles API error: ${response.status}`);
        }

        const candles = await response.json();
        
        return new Response(
          JSON.stringify({ 
            ok: true, 
            data: candles 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('[01-market-data] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
