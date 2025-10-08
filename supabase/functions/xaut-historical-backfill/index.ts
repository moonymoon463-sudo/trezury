import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { days = 90 } = await req.json().catch(() => ({ days: 90 }));
    
    console.log(`🔄 Starting XAUT historical backfill for last ${days} days...`);

    // Calculate date range
    const toTimestamp = Math.floor(Date.now() / 1000);
    const fromTimestamp = toTimestamp - (days * 24 * 60 * 60);

    console.log(`📅 Date range: ${new Date(fromTimestamp * 1000).toISOString()} to ${new Date(toTimestamp * 1000).toISOString()}`);

    // Fetch XAUT historical data from CoinGecko
    const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/tether-gold/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`;
    
    console.log('📡 Fetching from CoinGecko...');
    const response = await fetch(coingeckoUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const prices = data.prices || [];
    
    console.log(`✅ Received ${prices.length} price points from CoinGecko`);

    if (prices.length === 0) {
      throw new Error('No historical data received from CoinGecko');
    }

    // Group prices by day and calculate OHLC
    const dailyData = new Map<string, { open: number; high: number; low: number; close: number; prices: number[] }>();

    prices.forEach(([timestamp, price]: [number, number]) => {
      const date = new Date(timestamp).toISOString().split('T')[0];
      
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          open: price,
          high: price,
          low: price,
          close: price,
          prices: []
        });
      }
      
      const day = dailyData.get(date)!;
      day.high = Math.max(day.high, price);
      day.low = Math.min(day.low, price);
      day.close = price; // Last price of the day
      day.prices.push(price);
    });

    console.log(`📊 Processed into ${dailyData.size} daily OHLC entries`);

    // Prepare data for insertion
    const insertData = Array.from(dailyData.entries()).map(([date, ohlc]) => ({
      date,
      open_price: ohlc.open,
      high_price: ohlc.high,
      low_price: ohlc.low,
      close_price: ohlc.close,
      volume: 0, // CoinGecko free API doesn't provide reliable volume for XAUT
      source: 'xaut_historical'
    }));

    console.log(`💾 Inserting ${insertData.length} records into gold_price_history...`);

    // Upsert data (conflict on date + source)
    const { data: inserted, error: insertError } = await supabase
      .from('gold_price_history')
      .upsert(insertData, { 
        onConflict: 'date,source',
        ignoreDuplicates: false 
      })
      .select();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      throw insertError;
    }

    console.log(`✅ Successfully upserted ${inserted?.length || insertData.length} historical XAUT records`);

    return new Response(
      JSON.stringify({
        success: true,
        days,
        records_processed: dailyData.size,
        records_inserted: inserted?.length || insertData.length,
        date_range: {
          from: new Date(fromTimestamp * 1000).toISOString().split('T')[0],
          to: new Date(toTimestamp * 1000).toISOString().split('T')[0]
        },
        source: 'xaut_historical',
        message: 'XAUT historical data backfill completed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ XAUT historical backfill error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
