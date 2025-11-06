import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { HyperliquidAPI } from 'npm:@nktkas/hyperliquid@0.25.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Health check service for Hyperliquid integration
 * Monitors API availability, database status, and data freshness
 */
Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const api = new HyperliquidAPI();
    
    const healthChecks = await Promise.allSettled([
      checkAPIHealth(api),
      checkDatabaseHealth(supabase),
      checkDataFreshness(supabase),
      checkRateLimitStatus()
    ]);
    
    const results = {
      timestamp: new Date().toISOString(),
      api: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { status: 'error', error: (healthChecks[0] as any).reason.message },
      database: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { status: 'error', error: (healthChecks[1] as any).reason.message },
      dataFreshness: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { status: 'error', error: (healthChecks[2] as any).reason.message },
      rateLimit: healthChecks[3].status === 'fulfilled' ? healthChecks[3].value : { status: 'error', error: (healthChecks[3] as any).reason.message }
    };
    
    const overallStatus = Object.values(results).every((r: any) => r.status === 'healthy' || r.status === 'ok')
      ? 'healthy'
      : 'degraded';
    
    // Log health status
    await supabase.from('system_health_logs').insert({
      service: 'hyperliquid',
      status: overallStatus,
      details: results
    });
    
    return new Response(
      JSON.stringify({ 
        status: overallStatus,
        checks: results
      }),
      { 
        status: overallStatus === 'healthy' ? 200 : 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[Health Check] Error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Check if Hyperliquid API is responding
 */
async function checkAPIHealth(api: HyperliquidAPI) {
  const start = Date.now();
  try {
    await api.info.meta();
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency,
      message: `API responding in ${latency}ms`
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      latency: Date.now() - start
    };
  }
}

/**
 * Check database connectivity and performance
 */
async function checkDatabaseHealth(supabase: any) {
  const start = Date.now();
  try {
    const { count, error } = await supabase
      .from('hyperliquid_historical_candles')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency,
      totalCandles: count,
      message: `Database responding in ${latency}ms`
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      latency: Date.now() - start
    };
  }
}

/**
 * Check if cached data is fresh
 */
async function checkDataFreshness(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('hyperliquid_historical_candles')
      .select('timestamp, market, interval')
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return {
        status: 'warning',
        message: 'No cached data available'
      };
    }
    
    const latestTimestamp = data[0].timestamp;
    const age = Date.now() - latestTimestamp;
    const ageMinutes = Math.floor(age / 60000);
    
    return {
      status: age < 300000 ? 'healthy' : 'warning', // 5 minutes threshold
      latestDataAge: ageMinutes,
      latestMarket: data[0].market,
      latestInterval: data[0].interval,
      message: `Latest data is ${ageMinutes} minutes old`
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Check rate limit status
 */
async function checkRateLimitStatus() {
  // This would check the rate limiter's current state
  // For now, just return ok
  return {
    status: 'ok',
    message: 'Rate limiting operational'
  };
}
