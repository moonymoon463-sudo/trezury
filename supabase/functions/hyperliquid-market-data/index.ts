import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { rateLimiter, retryWithBackoff } from '../_shared/hyperliquidRateLimit.ts';
import { hyperliquidCache } from '../_shared/hyperliquidCache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz';

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
    
    // Initialize Supabase client for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate cache key for deduplication and caching
    const cacheKey = `${operation}:${JSON.stringify(params || {})}`;
    
    // Check memory cache first
    const cachedData = hyperliquidCache.get(cacheKey);
    if (cachedData) {
      console.log('[Cache] Hit:', cacheKey);
      return new Response(JSON.stringify(cachedData), {
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

    // Deduplicate concurrent requests and apply rate limiting with retry
    const result = await rateLimiter.deduplicateRequest(cacheKey, async () => {
      // Wait for rate limit availability
      await rateLimiter.waitForAvailability();
      
      // Make request with retry logic
      return await retryWithBackoff(async () => {
        rateLimiter.recordRequest();
        
        const response = await fetch(`${HYPERLIQUID_API}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const error: any = new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
          error.status = response.status;
          throw error;
        }

        return await response.json();
      }, 3, 1000);
    });

    const data = result;

    // Transform data based on operation
    let transformedResult = data;
    
    if (operation === 'get_markets') {
      transformedResult = data.universe || [];
    } else if (operation === 'get_candles') {
      // Hyperliquid candleSnapshot returns array format: [[timestamp, open, high, low, close, volume], ...]
      // Transform to object format: { t, T, s, i, o, c, h, l, v, n }
      console.log('[Hyperliquid] Raw candle response:', JSON.stringify(data).slice(0, 500));
      
      const interval = normalizeInterval(params.interval);
      const intervalMs = getIntervalMs(interval);
      const candles = Array.isArray(data) ? data : [];
      
      transformedResult = candles.map((candle: any) => {
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
      
      console.log('[Hyperliquid] Transformed candles:', transformedResult.length, 'candles');
      
      // Store candles in database for persistence
      if (transformedResult.length > 0) {
        const candlesToStore = transformedResult.map((c: any) => ({
          market: params.market,
          interval: interval,
          timestamp: c.t,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
          volume: c.v
        }));
        
        try {
          const { error: dbError } = await supabaseClient
            .from('hyperliquid_historical_candles')
            .upsert(candlesToStore, { 
              onConflict: 'market,interval,timestamp',
              ignoreDuplicates: false 
            });
          
          if (dbError) {
            console.error('[Hyperliquid] Error storing candles:', dbError);
          } else {
            console.log('[Hyperliquid] Stored', candlesToStore.length, 'candles in database');
          }
        } catch (dbError) {
          console.error('[Hyperliquid] Database error:', dbError);
        }
      }
    } else if (operation === 'get_trades') {
      transformedResult = (data || []).slice(0, params.limit || 50);
    } else if (operation === 'get_user_fills') {
      transformedResult = (data || []).slice(0, params.limit || 100);
    } else if (operation === 'get_funding') {
      const normalizedMarket = normalizeMarket(params.market);
      const marketData = data.universe?.find((m: any) => m.name === normalizedMarket);
      transformedResult = {
        coin: params.market, // Return original market name
        fundingRate: marketData?.funding || '0',
        premium: marketData?.premium || '0',
        time: Date.now()
      };
    }

    // Cache the result with appropriate TTL
    hyperliquidCache.set(cacheKey, transformedResult, operation, params.interval);

    return new Response(JSON.stringify(transformedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Hyperliquid market data error:', error);
    
    // Try to return cached data from database on error
    if (operation === 'get_candles' && params) {
      const normalizedInterval = normalizeInterval(params.interval);
      const start = normalizeTime(params.startTime);
      const end = normalizeTime(params.endTime);
      
      if (start && end) {
        console.log('[Error Recovery] Attempting to fetch from database...');
        const dbCandles = await hyperliquidCache.getCandlesFromDB(
          supabaseClient,
          params.market,
          normalizedInterval,
          start,
          end
        );
        
        if (dbCandles && dbCandles.length > 0) {
          console.log('[Error Recovery] Returning', dbCandles.length, 'candles from database');
          return new Response(JSON.stringify(dbCandles), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }
    
    // Log rate limit metrics on error
    const metrics = rateLimiter.getMetrics();
    console.error('[Rate Limit Metrics]', metrics);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: error.status,
        metrics
      }),
      {
        status: error.status || 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
