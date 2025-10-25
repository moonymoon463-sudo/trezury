import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DYDX_INDEXER_URL = 'https://indexer.dydx.trade/v4';

// In-memory cache with TTL
const cache = new Map<string, { data: any; expires: number }>();

function getCached(key: string): any | null {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttlSeconds: number): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, params = {} } = await req.json();
    console.log(`[dYdX] Operation: ${operation}`, params);

    let result: any;
    const cacheKey = `${operation}_${JSON.stringify(params)}`;

    switch (operation) {
      case 'get_markets': {
        const cached = getCached(cacheKey);
        if (cached) {
          console.log('[dYdX] Returning cached markets');
          return new Response(JSON.stringify(cached), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const response = await fetch(`${DYDX_INDEXER_URL}/perpetualMarkets`);
        const data = await response.json();

        // Transform to our format
        const markets = Object.entries(data.markets || {}).map(([ticker, market]: [string, any]) => ({
          symbol: ticker,
          name: market.name || ticker,
          price: parseFloat(market.oraclePrice || '0'),
          change24h: parseFloat(market.priceChange24H || '0'),
          changePercent24h: parseFloat(market.priceChange24HPercent || '0') * 100,
          volume24h: parseFloat(market.volume24H || '0'),
          high24h: parseFloat(market.high24H || '0'),
          low24h: parseFloat(market.low24H || '0'),
          fundingRate: parseFloat(market.nextFundingRate || '0'),
          nextFundingTime: market.nextFundingAt ? new Date(market.nextFundingAt).getTime() : null,
          lastUpdated: Date.now(),
        }));

        result = { markets };
        setCache(cacheKey, result, 10); // Cache for 10 seconds
        break;
      }

      case 'get_orderbook': {
        const { market } = params;
        if (!market) throw new Error('market parameter required');

        const cached = getCached(cacheKey);
        if (cached) {
          console.log('[dYdX] Returning cached orderbook');
          return new Response(JSON.stringify(cached), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const response = await fetch(`${DYDX_INDEXER_URL}/orderbooks/perpetualMarket/${market}`);
        const data = await response.json();

        result = {
          market,
          bids: (data.bids || []).map((b: any) => ({ price: b.price, size: b.size })),
          asks: (data.asks || []).map((a: any) => ({ price: a.price, size: a.size })),
          lastUpdated: Date.now(),
        };

        setCache(cacheKey, result, 5); // Cache for 5 seconds
        break;
      }

      case 'get_candles': {
        const { market, resolution = '1HOUR', limit = 100 } = params;
        if (!market) throw new Error('market parameter required');

        const cached = getCached(cacheKey);
        if (cached) {
          console.log('[dYdX] Returning cached candles');
          return new Response(JSON.stringify(cached), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const response = await fetch(
          `${DYDX_INDEXER_URL}/candles/perpetualMarkets/${market}?resolution=${resolution}&limit=${limit}`
        );
        
        if (!response.ok) {
          throw new Error(`dYdX API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Sanitize and validate candles on the backend
        const sanitizedCandles = (data.candles || [])
          .map((candle: any) => {
            try {
              const timestamp = new Date(candle.startedAt).getTime() / 1000;
              const open = parseFloat(candle.open);
              const high = parseFloat(candle.high);
              const low = parseFloat(candle.low);
              const close = parseFloat(candle.close);
              const volume = parseFloat(candle.baseTokenVolume);

              // Validate all values are numbers and not NaN
              if (
                !isFinite(timestamp) ||
                !isFinite(open) ||
                !isFinite(high) ||
                !isFinite(low) ||
                !isFinite(close) ||
                !isFinite(volume) ||
                timestamp <= 0 ||
                open <= 0 ||
                high <= 0 ||
                low <= 0 ||
                close <= 0 ||
                volume < 0
              ) {
                console.warn('[dYdX] Invalid candle data:', candle);
                return null;
              }

              // Validate OHLC relationships
              if (high < low || high < open || high < close || low > open || low > close) {
                console.warn('[dYdX] Invalid OHLC relationships:', candle);
                return null;
              }

              return {
                timestamp,
                open,
                high,
                low,
                close,
                volume,
              };
            } catch (error) {
              console.error('[dYdX] Error parsing candle:', error, candle);
              return null;
            }
          })
          .filter((candle: any) => candle !== null);

        console.log(`[dYdX] Sanitized ${sanitizedCandles.length}/${data.candles?.length || 0} candles for ${market}`);

        // Sort ascending by timestamp (required by lightweight-charts)
        sanitizedCandles.sort((a: any, b: any) => a.timestamp - b.timestamp);

        result = { candles: sanitizedCandles };
        setCache(cacheKey, result, 30); // Cache for 30 seconds
        break;
      }

      case 'get_trades': {
        const { market, limit = 50 } = params;
        if (!market) throw new Error('market parameter required');

        const response = await fetch(
          `${DYDX_INDEXER_URL}/trades/perpetualMarket/${market}?limit=${limit}`
        );
        const data = await response.json();

        result = {
          trades: (data.trades || []).map((t: any) => ({
            id: t.id,
            side: t.side,
            size: parseFloat(t.size),
            price: parseFloat(t.price),
            timestamp: new Date(t.createdAt).getTime(),
          })),
        };
        break;
      }

      case 'get_positions': {
        const { address } = params;
        if (!address) throw new Error('address parameter required');

        const response = await fetch(`${DYDX_INDEXER_URL}/addresses/${address}/subaccountNumber/0`);
        
        if (!response.ok) {
          result = { positions: [] };
          break;
        }

        const data = await response.json();
        const positions = data.subaccount?.openPerpetualPositions || {};

        result = {
          positions: Object.entries(positions).map(([market, pos]: [string, any]) => ({
            market,
            side: parseFloat(pos.size) > 0 ? 'LONG' : 'SHORT',
            size: Math.abs(parseFloat(pos.size || '0')),
            entryPrice: parseFloat(pos.entryPrice || '0'),
            unrealizedPnl: parseFloat(pos.unrealizedPnl || '0'),
            realizedPnl: parseFloat(pos.realizedPnl || '0'),
          })),
        };
        break;
      }

      case 'get_funding': {
        const { market } = params;
        if (!market) throw new Error('market parameter required');

        const response = await fetch(`${DYDX_INDEXER_URL}/perpetualMarkets/${market}`);
        const data = await response.json();

        result = {
          fundingRate: parseFloat(data.market?.nextFundingRate || '0'),
          nextFundingTime: data.market?.nextFundingAt ? new Date(data.market.nextFundingAt).getTime() : null,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    console.log(`[dYdX] Success: ${operation}`);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[dYdX] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
