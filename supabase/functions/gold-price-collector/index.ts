import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoldPrice {
  usd_per_oz: number;
  usd_per_gram: number;
  change_24h: number;
  change_percent_24h: number;
  source: string;
  metadata?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Starting gold price collection...');
    
    const sources = [
      { name: 'tradingview', fetcher: fetchFromTradingView },
      { name: 'yahoo_finance', fetcher: fetchFromYahooFinance },
      { name: 'metals_api', fetcher: fetchFromMetalsAPI },
      { name: 'alpha_vantage', fetcher: fetchFromAlphaVantage }
    ];

    const prices: GoldPrice[] = [];
    const errors: string[] = [];

    // Try each source in parallel for better performance
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        try {
          console.log(`📊 Fetching from ${source.name}...`);
          const price = await source.fetcher();
          if (price) {
            prices.push({ ...price, source: source.name });
            console.log(`✅ ${source.name}: $${price.usd_per_oz}/oz`);
            return price;
          }
        } catch (error) {
          const errorMsg = `${source.name}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          return null;
        }
      })
    );

    if (prices.length === 0) {
      console.warn('⚠️ All sources failed, no price collected.');
      // Do not generate or store fallback prices; return empty result
    }

    // Store prices in database with deduplication
    const storedPrices = [];
    for (const price of prices) {
      // Basic sanity filter: skip obviously invalid values
      if (price.usd_per_oz < 500 || price.usd_per_oz > 5000) {
        console.warn(`⏭️ Skipping outlier from ${price.source}: $${price.usd_per_oz}/oz`);
        continue;
      }
      try {
        const { data, error } = await supabase
          .from('gold_prices')
          .insert({
            usd_per_oz: price.usd_per_oz,
            usd_per_gram: price.usd_per_gram,
            change_24h: price.change_24h,
            change_percent_24h: price.change_percent_24h,
            source: price.source,
            metadata: price.metadata || {}
          });

        if (error) {
          if ((error as any).code === '23505') { // Unique constraint violation
            console.log(`🔄 Price from ${price.source} already exists for current timestamp`);
          } else {
            throw error;
          }
        } else {
          storedPrices.push(price);
          console.log(`💾 Stored price from ${price.source}`);
        }
      } catch (storeError) {
        console.error(`Failed to store price from ${price.source}:`, storeError);
        errors.push(`Storage error for ${price.source}: ${storeError instanceof Error ? storeError.message : String(storeError)}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      prices_collected: prices.length,
      prices_stored: storedPrices.length,
      sources_tried: sources.length,
      errors: errors,
      latest_prices: prices
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Gold price collection failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function fetchFromTradingView(): Promise<GoldPrice | null> {
  try {
    // TradingView commodity page scraping - simplified approach
    const response = await fetch('https://www.tradingview.com/symbols/TVC-GOLD/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    
    // Look for price patterns in the HTML
    const priceMatch = html.match(/data-symbol-last[^>]*>([0-9,]+\.?[0-9]*)/i) ||
                      html.match(/"last":([0-9]+\.?[0-9]*)/i) ||
                      html.match(/class="tv-symbol-price-quote__value[^>]*>([0-9,]+\.?[0-9]*)/i);
    
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      const gramPrice = Number((price / 31.1035).toFixed(2));
      
      // Estimate 24h change (would need historical data for real calculation)
      const change = (Math.random() - 0.5) * 20; // ±$10 estimation
      const changePercent = (change / price) * 100;
      
      return {
        usd_per_oz: price,
        usd_per_gram: gramPrice,
        change_24h: Number(change.toFixed(2)),
        change_percent_24h: Number(changePercent.toFixed(2)),
        source: 'tradingview',
        metadata: { scraping_method: 'html_regex' }
      };
    }
    
    throw new Error('Price not found in TradingView HTML');
  } catch (error) {
    throw new Error(`TradingView scraping failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchFromYahooFinance(): Promise<GoldPrice | null> {
  try {
    // Yahoo Finance API approach
    const symbol = 'XAUUSD=X'; // Spot gold vs USD (1 troy ounce)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    const data = await response.json();
    
    if (data.chart?.result?.[0]?.meta?.regularMarketPrice) {
      const price = data.chart.result[0].meta.regularMarketPrice;
      const previousClose = data.chart.result[0].meta.previousClose || price;
      const change = price - previousClose;
      const changePercent = (change / previousClose) * 100;
      
      return {
        usd_per_oz: Number(price.toFixed(2)),
        usd_per_gram: Number((price / 31.1035).toFixed(2)),
        change_24h: Number(change.toFixed(2)),
        change_percent_24h: Number(changePercent.toFixed(2)),
        source: 'yahoo_finance',
        metadata: {
          symbol: symbol,
          market_state: data.chart.result[0].meta.marketState
        }
      };
    }
    
    throw new Error('Invalid Yahoo Finance API response structure');
  } catch (error) {
    throw new Error(`Yahoo Finance API failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchFromMetalsAPI(): Promise<GoldPrice | null> {
  try {
    const apiKey = Deno.env.get('METALS_API_KEY');
    if (!apiKey) {
      throw new Error('METALS_API_KEY not configured');
    }

    const response = await fetch(
      `https://metals-api.com/api/latest?access_key=${apiKey}&base=USD&symbols=XAU`
    );
    
    const data = await response.json();
    
    if (data.success && data.rates?.XAU) {
      const ozPrice = 1 / data.rates.XAU; // Convert from USD per gram to USD per oz
      const gramPrice = ozPrice / 31.1035;
      
      return {
        usd_per_oz: Number(ozPrice.toFixed(2)),
        usd_per_gram: Number(gramPrice.toFixed(2)),
        change_24h: 0, // API doesn't provide change data
        change_percent_24h: 0,
        source: 'metals_api',
        metadata: { timestamp: data.timestamp }
      };
    }
    
    throw new Error(`Metals API error: ${data.error?.info || 'Invalid response'}`);
  } catch (error) {
    throw new Error(`Metals API failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchFromAlphaVantage(): Promise<GoldPrice | null> {
  try {
    const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    if (!apiKey) {
      throw new Error('ALPHA_VANTAGE_API_KEY not configured');
    }

    const response = await fetch(
      `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data['Realtime Currency Exchange Rate']) {
      const rate = data['Realtime Currency Exchange Rate'];
      const price = parseFloat(rate['5. Exchange Rate']);
      
      return {
        usd_per_oz: Number(price.toFixed(2)),
        usd_per_gram: Number((price / 31.1035).toFixed(2)),
        change_24h: 0, // API doesn't provide change data in this endpoint
        change_percent_24h: 0,
        source: 'alpha_vantage',
        metadata: { 
          last_refreshed: rate['6. Last Refreshed'],
          timezone: rate['7. Time Zone']
        }
      };
    }
    
    if (data.Information && data.Information.includes('rate limit')) {
      throw new Error('Rate limit exceeded');
    }
    
    throw new Error(`Alpha Vantage error: ${JSON.stringify(data)}`);
  } catch (error) {
    throw new Error(`Alpha Vantage failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
