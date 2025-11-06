import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { HyperliquidAPI } from 'npm:@nktkas/hyperliquid@0.25.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Background service to proactively collect Hyperliquid market data
 * Runs periodically to ensure fresh data is always available
 */
Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const api = new HyperliquidAPI();
    
    const { operation } = await req.json();
    
    if (operation === 'collect_candles') {
      return await collectCandles(api, supabase);
    } else if (operation === 'collect_markets') {
      return await collectMarkets(api, supabase);
    }
    
    return new Response(
      JSON.stringify({ error: 'Unknown operation' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Candle Collector] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Collect candles for popular markets
 */
async function collectCandles(api: HyperliquidAPI, supabase: any) {
  const popularMarkets = ['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'MATIC'];
  const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const results = [];
  
  for (const market of popularMarkets) {
    for (const interval of intervals) {
      try {
        // Get last 100 candles for each market/interval
        const endTime = Date.now();
        const intervalMs = getIntervalMs(interval);
        const startTime = endTime - (intervalMs * 100);
        
        const candles = await api.info.candleSnapshot({
          coin: market,
          interval,
          startTime,
          endTime
        });
        
        if (!candles || candles.length === 0) continue;
        
        // Store in database
        const candleRecords = candles.map(c => ({
          market,
          interval,
          timestamp: c.t,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
          volume: c.v
        }));
        
        const { error } = await supabase
          .from('hyperliquid_historical_candles')
          .upsert(candleRecords, {
            onConflict: 'market,interval,timestamp',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error(`[Collector] Error storing ${market} ${interval}:`, error);
        } else {
          results.push({
            market,
            interval,
            candlesStored: candleRecords.length,
            timeRange: { startTime, endTime }
          });
        }
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[Collector] Error collecting ${market} ${interval}:`, error);
      }
    }
  }
  
  return new Response(
    JSON.stringify({ 
      success: true,
      results,
      timestamp: new Date().toISOString()
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Collect and cache market metadata
 */
async function collectMarkets(api: HyperliquidAPI, supabase: any) {
  try {
    const meta = await api.info.meta();
    const allMids = await api.info.allMids();
    
    const markets = meta.universe.map((u: any) => ({
      name: u.name,
      szDecimals: u.szDecimals,
      maxLeverage: u.maxLeverage,
      onlyIsolated: u.onlyIsolated,
      price: allMids[u.name] || '0'
    }));
    
    // Store in a markets cache table (you may need to create this)
    // For now, we'll just return it
    
    return new Response(
      JSON.stringify({ 
        success: true,
        markets,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Collector] Error collecting markets:', error);
    throw error;
  }
}

function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000
  };
  return map[interval] || 60_000;
}
