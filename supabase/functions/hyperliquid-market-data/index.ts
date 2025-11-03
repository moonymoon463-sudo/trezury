import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz';
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

// Helper to normalize market names (remove -USD suffix)
const normalizeMarket = (market: string): string => {
  return market?.replace(/-USD$/, '') || market;
};

// Helper to normalize interval values to Hyperliquid format
const normalizeInterval = (interval?: string): string => {
  if (!interval) return '1m';
  const v = String(interval).toLowerCase();
  const map: Record<string, string> = {
    '1': '1m', '1m': '1m', '1min': '1m', '60s': '1m', '60sec': '1m',
    '5': '5m', '5m': '5m', '5min': '5m',
    '15': '15m', '15m': '15m', '15min': '15m',
    '1h': '1h', '1hour': '1h', '60min': '1h', '1hour(s)': '1h', '1hr': '1h', '1hours': '1h', '1hourly': '1h', '1hourly': '1h', '1hourly': '1h', '1hourly': '1h',
    '4h': '4h', '4hour': '4h', '240min': '4h', '4hr': '4h', '4hours': '4h',
    '1d': '1d', '1day': '1d', '24h': '1d'
  };
  return map[v] ?? (v.replace('hour', 'h').replace('hours', 'h') === '1h' ? '1h' : '1m');
};

// Helper to normalize timestamps to milliseconds
const normalizeTime = (t: any): number | undefined => {
  if (t === undefined || t === null) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  // If seconds, convert to ms
  if (n < 1e12) return Math.floor(n * 1000);
  return Math.floor(n);
};

// Helper to get interval in milliseconds
const getIntervalMs = (interval: string): number => {
  const map: Record<string, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000
  };
  return map[interval] || 60_000;
};

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
        requestBody = { type: 'l2Book', coin: normalizeMarket(params.market) };
        break;
      case 'get_trades':
        requestBody = { type: 'recentTrades', coin: normalizeMarket(params.market) };
        break;
      case 'get_candles':
        const interval = normalizeInterval(params.interval);
        const start = normalizeTime(params.startTime);
        const end = normalizeTime(params.endTime);
        requestBody = {
          type: 'candleSnapshot',
          req: {
            coin: normalizeMarket(params.market),
            interval,
            startTime: start,
            endTime: end
          }
        };
        console.log('[Hyperliquid] Candle request:', JSON.stringify(requestBody));
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
    } else if (operation === 'get_candles') {
      // Hyperliquid candleSnapshot returns array format: [[timestamp, open, high, low, close, volume], ...]
      // Transform to object format: { t, T, s, i, o, c, h, l, v, n }
      console.log('[Hyperliquid] Raw candle response:', JSON.stringify(data).slice(0, 500));
      
      const interval = normalizeInterval(params.interval);
      const intervalMs = getIntervalMs(interval);
      const candles = Array.isArray(data) ? data : [];
      
      result = candles.map((candle: any) => {
        // Handle both array format and object format
        const isArray = Array.isArray(candle);
        const timestamp = isArray ? candle[0] : (candle.t || candle.timestamp);
        
        return {
          t: timestamp, // timestamp in ms
          T: timestamp + intervalMs, // close time
          s: params.market, // symbol
          i: interval, // interval
          o: String(isArray ? candle[1] : (candle.o || candle.open)), // open
          c: String(isArray ? candle[4] : (candle.c || candle.close)), // close
          h: String(isArray ? candle[2] : (candle.h || candle.high)), // high
          l: String(isArray ? candle[3] : (candle.l || candle.low)), // low
          v: String(isArray ? (candle[5] || '0') : (candle.v || candle.volume || '0')), // volume
          n: isArray ? 0 : (candle.n || 0) // number of trades
        };
      });
      
      console.log('[Hyperliquid] Transformed candles:', result.length, 'candles');
    } else if (operation === 'get_trades') {
      result = (data || []).slice(0, params.limit || 50);
    } else if (operation === 'get_user_fills') {
      result = (data || []).slice(0, params.limit || 100);
    } else if (operation === 'get_funding') {
      const normalizedMarket = normalizeMarket(params.market);
      const marketData = data.universe?.find((m: any) => m.name === normalizedMarket);
      result = {
        coin: params.market, // Return original market name
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
