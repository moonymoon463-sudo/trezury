import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface XAUTPrice {
  source: string;
  usd_per_oz: number;
  timestamp: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we need to backfill historical data
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const MIN_POINTS_12H = 100; // Threshold to ensure visually rich 12h chart
    const { count, error: countError } = await supabase
      .from('gold_prices')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'xaut_composite')
      .gte('timestamp', twelveHoursAgo);

    console.log(`📊 Existing 12h XAUT points: ${count ?? 0}`);

    if (!countError && ((count ?? 0) < MIN_POINTS_12H)) {
      console.log('📊 Insufficient historical data, backfilling last 12 hours...');
      await backfillHistoricalData(supabase);
    }

    console.log('🔄 Fetching XAUT prices from multiple sources...');

    const prices = await fetchXAUTPrices();
    
    if (prices.length === 0) {
      console.error('❌ No prices could be fetched from any source');
      return new Response(
        JSON.stringify({ success: false, error: 'No prices available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Calculate median price for accuracy
    const sortedPrices = prices.map(p => p.usd_per_oz).sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
    const usd_per_gram = medianPrice / 31.1035;

    console.log(`✅ XAUT Price: $${medianPrice.toFixed(2)}/oz (from ${prices.length} sources)`);

    // Calculate 24h change (compare with yesterday's price)
    const { data: yesterdayPrice } = await supabase
      .from('gold_prices')
      .select('usd_per_oz')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    let change_24h = 0;
    let change_percent_24h = 0;
    
    if (yesterdayPrice) {
      const oldPrice = Number(yesterdayPrice.usd_per_oz);
      change_24h = medianPrice - oldPrice;
      change_percent_24h = (change_24h / oldPrice) * 100;
    }

    // Store the price
    const { error: insertError } = await supabase
      .from('gold_prices')
      .insert({
        source: 'xaut_composite',
        usd_per_oz: medianPrice,
        usd_per_gram: usd_per_gram,
        change_24h: change_24h,
        change_percent_24h: change_percent_24h,
        metadata: {
          sources: prices.map(p => p.source),
          individual_prices: prices.map(p => ({ source: p.source, price: p.usd_per_oz }))
        }
      });

    if (insertError) {
      console.error('❌ Failed to store price:', insertError);
      throw insertError;
    }

    console.log('💾 Price stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        price: medianPrice,
        sources: prices.length,
        change_24h,
        change_percent_24h
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function fetchXAUTPrices(): Promise<XAUTPrice[]> {
  const prices: XAUTPrice[] = [];
  const timeout = 5000; // 5 second timeout per API

  // CoinGecko API (free, no key needed)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (data['tether-gold']?.usd) {
      prices.push({
        source: 'coingecko',
        usd_per_oz: data['tether-gold'].usd,
        timestamp: Date.now()
      });
      console.log(`✅ CoinGecko: $${data['tether-gold'].usd}`);
    }
  } catch (e) {
    console.warn('⚠️ CoinGecko failed:', e.message);
  }

  // CryptoCompare API (free tier)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/price?fsym=XAUT&tsyms=USD',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (data.USD) {
      prices.push({
        source: 'cryptocompare',
        usd_per_oz: data.USD,
        timestamp: Date.now()
      });
      console.log(`✅ CryptoCompare: $${data.USD}`);
    }
  } catch (e) {
    console.warn('⚠️ CryptoCompare failed:', e.message);
  }

  // Coinbase API (public, no auth)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(
      'https://api.coinbase.com/v2/prices/XAUT-USD/spot',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    
    const data = await response.json();
    if (data.data?.amount) {
      prices.push({
        source: 'coinbase',
        usd_per_oz: parseFloat(data.data.amount),
        timestamp: Date.now()
      });
      console.log(`✅ Coinbase: $${data.data.amount}`);
    }
  } catch (e) {
    console.warn('⚠️ Coinbase failed:', e.message);
  }

  return prices;
}

async function backfillHistoricalData(supabase: any) {
  try {
    // Fetch 12 hours of historical XAUT data from CoinGecko
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/tether-gold/market_chart?vs_currency=usd&days=0.5&interval=minute'
    );
    
    const data = await response.json();
    
    if (!data.prices || !Array.isArray(data.prices)) {
      console.error('❌ No historical data available from CoinGecko');
      return;
    }

    console.log(`📥 Fetched ${data.prices.length} historical data points`);

    // Process and insert data points (bucket into 5-minute intervals)
    const bucketedData: { [key: number]: number[] } = {};
    const bucketSize = 5 * 60 * 1000; // 5 minutes in milliseconds

    for (const [timestamp, price] of data.prices) {
      const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize;
      if (!bucketedData[bucketKey]) {
        bucketedData[bucketKey] = [];
      }
      bucketedData[bucketKey].push(price);
    }

    // Calculate median for each bucket and prepare insert data
    const insertData = Object.entries(bucketedData).map(([timestamp, prices]) => {
      const sortedPrices = prices.sort((a, b) => a - b);
      const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
      const usd_per_gram = medianPrice / 31.1035;

      return {
        source: 'xaut_composite',
        usd_per_oz: medianPrice,
        usd_per_gram: usd_per_gram,
        timestamp: new Date(parseInt(timestamp)).toISOString(),
        change_24h: 0,
        change_percent_24h: 0,
        metadata: {
          sources: ['coingecko_historical'],
          backfilled: true
        }
      };
    });

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < insertData.length; i += batchSize) {
      const batch = insertData.slice(i, i + batchSize);
      const { error } = await supabase
        .from('gold_prices')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error);
      } else {
        console.log(`✅ Inserted batch ${i / batchSize + 1} (${batch.length} records)`);
      }
    }

    console.log(`✅ Backfill complete: ${insertData.length} data points added`);
  } catch (error) {
    console.error('❌ Backfill error:', error);
  }
}
