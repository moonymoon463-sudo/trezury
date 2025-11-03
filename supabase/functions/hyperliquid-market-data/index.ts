import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz';
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, params } = await req.json();

    const cacheKey = `${operation}:${JSON.stringify(params || {})}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let requestBody: any;
    
    switch (operation) {
      case 'get_markets':
        requestBody = { type: 'meta' };
        break;
      case 'get_orderbook':
        requestBody = { type: 'l2Book', coin: params.market };
        break;
      case 'get_trades':
        requestBody = { type: 'recentTrades', coin: params.market };
        break;
      case 'get_candles':
        requestBody = {
          type: 'candleSnapshot',
          req: {
            coin: params.market,
            interval: params.interval || '1m',
            startTime: params.startTime,
            endTime: params.endTime
          }
        };
        break;
      case 'get_user_state':
        requestBody = { type: 'clearinghouseState', user: params.address };
        break;
      case 'get_user_fills':
        requestBody = { type: 'userFills', user: params.address };
        break;
      case 'get_open_orders':
        requestBody = { type: 'openOrders', user: params.address };
        break;
      case 'get_funding':
        requestBody = { type: 'meta' };
        break;
      case 'get_all_mids':
        requestBody = { type: 'allMids' };
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const response = await fetch(`${HYPERLIQUID_API}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform data based on operation
    let result = data;
    
    if (operation === 'get_markets') {
      result = data.universe || [];
    } else if (operation === 'get_trades') {
      result = (data || []).slice(0, params.limit || 50);
    } else if (operation === 'get_user_fills') {
      result = (data || []).slice(0, params.limit || 100);
    } else if (operation === 'get_funding') {
      const marketData = data.universe?.find((m: any) => m.name === params.market);
      result = {
        coin: params.market,
        fundingRate: marketData?.funding || '0',
        premium: marketData?.premium || '0',
        time: Date.now()
      };
    }

    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Hyperliquid market data error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
