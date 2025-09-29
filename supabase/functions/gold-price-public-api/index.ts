import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { checkRateLimit, getClientIp, createRateLimitResponse, getRateLimitHeaders } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting: 100 requests per minute per IP
    const clientIp = getClientIp(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const rateLimitResult = await checkRateLimit(
      supabaseUrl,
      supabaseKey,
      clientIp,
      'gold-price-public-api',
      100, // max requests
      60000 // 1 minute window
    );

    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    console.log(`📡 Gold Price API: ${req.method} ${path}`);

    switch (path) {
      case 'latest':
        return await handleLatest(supabase, rateLimitResult);
      
      case 'history':
        const days = parseInt(url.searchParams.get('days') || '30');
        return await handleHistory(supabase, days, rateLimitResult);
      
      case 'average':
        const period = url.searchParams.get('period') || '24h';
        return await handleAverage(supabase, period, rateLimitResult);
      
      case 'sources':
        return await handleSources(supabase, rateLimitResult);
      
      default:
        return await handleDocs(rateLimitResult);
    }

  } catch (error) {
    console.error('🚨 Gold Price API error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleLatest(supabase: any, rateLimitResult: any) {
  try {
    const { data, error } = await supabase
      .from('gold_prices')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return new Response(JSON.stringify({
        error: 'No gold price data available'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        usd_per_oz: data.usd_per_oz,
        usd_per_gram: data.usd_per_gram,
        change_24h: data.change_24h,
        change_percent_24h: data.change_percent_24h,
        last_updated: data.timestamp,
        source: data.source
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        ...corsHeaders, 
        ...getRateLimitHeaders(rateLimitResult),
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    throw new Error(`Failed to fetch latest price: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleHistory(supabase: any, days: number, rateLimitResult: any) {
  try {
    // Validate days parameter
    if (days < 1 || days > 365) {
      return new Response(JSON.stringify({
        error: 'Days parameter must be between 1 and 365'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('gold_prices')
      .select('timestamp, usd_per_oz, usd_per_gram, change_24h, change_percent_24h, source')
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      data: data || [],
      period: {
        days: days,
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString()
      },
      count: data?.length || 0
    }), {
      headers: { 
        ...corsHeaders, 
        ...getRateLimitHeaders(rateLimitResult),
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    throw new Error(`Failed to fetch price history: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleAverage(supabase: any, period: string, rateLimitResult: any) {
  try {
    let hours: number;
    
    switch (period) {
      case '1h':
        hours = 1;
        break;
      case '24h':
        hours = 24;
        break;
      case '7d':
        hours = 24 * 7;
        break;
      case '30d':
        hours = 24 * 30;
        break;
      default:
        return new Response(JSON.stringify({
          error: 'Invalid period. Use: 1h, 24h, 7d, or 30d'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const { data, error } = await supabase
      .from('gold_prices')
      .select('usd_per_oz, usd_per_gram')
      .gte('timestamp', startDate.toISOString());

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({
        error: 'No data available for the specified period'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const avgOz = data.reduce((sum: number, price: any) => sum + parseFloat(price.usd_per_oz), 0) / data.length;
    const avgGram = data.reduce((sum: number, price: any) => sum + parseFloat(price.usd_per_gram), 0) / data.length;

    return new Response(JSON.stringify({
      success: true,
      data: {
        average_usd_per_oz: Number(avgOz.toFixed(2)),
        average_usd_per_gram: Number(avgGram.toFixed(2)),
        period: period,
        sample_count: data.length
      }
    }), {
      headers: { 
        ...corsHeaders, 
        ...getRateLimitHeaders(rateLimitResult),
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    throw new Error(`Failed to calculate average: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleSources(supabase: any, rateLimitResult: any) {
  try {
    const { data, error } = await supabase
      .from('gold_prices')
      .select('source, timestamp')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    // Group by source and get latest timestamp for each
    const sourceStats = data.reduce((acc: any, price: any) => {
      if (!acc[price.source]) {
        acc[price.source] = {
          source: price.source,
          latest_update: price.timestamp,
          total_entries: 0
        };
      }
      acc[price.source].total_entries++;
      return acc;
    }, {});

    return new Response(JSON.stringify({
      success: true,
      sources: Object.values(sourceStats)
    }), {
      headers: { 
        ...corsHeaders, 
        ...getRateLimitHeaders(rateLimitResult),
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    throw new Error(`Failed to fetch source info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleDocs(rateLimitResult: any) {
  const docs = {
    title: "Gold Price API",
    description: "Real-time and historical gold price data",
    version: "1.0.0",
    endpoints: {
      "GET /latest": {
        description: "Get the latest gold price",
        response: {
          usd_per_oz: "number",
          usd_per_gram: "number", 
          change_24h: "number",
          change_percent_24h: "number",
          last_updated: "ISO timestamp",
          source: "string"
        }
      },
      "GET /history?days=30": {
        description: "Get historical prices",
        parameters: {
          days: "1-365 (default: 30)"
        }
      },
      "GET /average?period=24h": {
        description: "Get average price for period",
        parameters: {
          period: "1h, 24h, 7d, or 30d"
        }
      },
      "GET /sources": {
        description: "Get information about data sources"
      }
    },
    rate_limits: {
      limit: 100,
      window: "1 hour",
      per: "IP address"
    }
  };

  return new Response(JSON.stringify(docs, null, 2), {
    headers: { 
      ...corsHeaders, 
      ...getRateLimitHeaders(rateLimitResult),
      'Content-Type': 'application/json' 
    }
  });
}