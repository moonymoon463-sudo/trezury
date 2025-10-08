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
