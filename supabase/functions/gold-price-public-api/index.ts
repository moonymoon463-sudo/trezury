import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Basic rate limiting (100 requests per hour per IP)
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const hourWindow = 60 * 60 * 1000; // 1 hour
    
    const clientLimit = rateLimitStore.get(clientIP);
    if (clientLimit) {
      if (now < clientLimit.resetTime) {
        if (clientLimit.count >= 100) {
          return new Response(JSON.stringify({
            error: 'Rate limit exceeded. Try again later.',
            limit: 100,
            window: '1 hour'
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        clientLimit.count++;
      } else {
        // Reset window
        rateLimitStore.set(clientIP, { count: 1, resetTime: now + hourWindow });
      }
    } else {
      rateLimitStore.set(clientIP, { count: 1, resetTime: now + hourWindow });
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
        return await handleLatest(supabase);
      
      case 'history':
        const days = parseInt(url.searchParams.get('days') || '30');
        return await handleHistory(supabase, days);
      
      case 'average':
        const period = url.searchParams.get('period') || '24h';
        return await handleAverage(supabase, period);
      
      case 'sources':
        return await handleSources(supabase);
      
      default:
        return await handleDocs();
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

async function handleLatest(supabase: any) {
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    throw new Error(`Failed to fetch latest price: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleHistory(supabase: any, days: number) {
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    throw new Error(`Failed to fetch price history: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleAverage(supabase: any, period: string) {
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    throw new Error(`Failed to calculate average: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleSources(supabase: any) {
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    throw new Error(`Failed to fetch source info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleDocs() {
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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}