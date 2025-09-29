import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { checkRateLimit, getClientIp, createRateLimitResponse, getRateLimitHeaders } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
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
      'gold-price-api',
      100, // max requests
      60000 // 1 minute window
    );

    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const alphaVantageApiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    
    if (!alphaVantageApiKey) {
      console.log('ALPHA_VANTAGE_API_KEY not configured, using fallback data');
      throw new Error('ALPHA_VANTAGE_API_KEY is not configured');
    }

    // Fetch gold price from Alpha Vantage API
    const response = await fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${alphaVantageApiKey}`);
    
    if (!response.ok) {
      console.log(`Alpha Vantage API HTTP error: ${response.status}`);
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Alpha Vantage API response:', JSON.stringify(data, null, 2));
    
    // Handle rate limiting and information messages gracefully
    if (data['Note'] && data['Note'].includes('API rate limit')) {
      console.log('API rate limit exceeded, using fallback data');
      throw new Error('Rate limit exceeded');
    }
    
    if (data['Information'] && data['Information'].includes('rate limit')) {
      console.log('Alpha Vantage daily rate limit reached, using fallback data');
      throw new Error('Rate limit exceeded');
    }
    
    if (data['Error Message']) {
      console.log('Alpha Vantage API error:', data['Error Message']);
      throw new Error(data['Error Message']);
    }

    if (!data['Realtime Currency Exchange Rate']) {
      console.log('Invalid response format, full response:', JSON.stringify(data, null, 2));
      throw new Error('Invalid response format from Alpha Vantage');
    }

    const exchangeRate = data['Realtime Currency Exchange Rate'];
    const goldPricePerOz = parseFloat(exchangeRate['5. Exchange Rate']); // Price per troy ounce
    const goldPricePerGram = goldPricePerOz / 31.1035; // 1 troy ounce = 31.1035 grams

    // Calculate 24h change (mock for now - Alpha Vantage free tier doesn't include historical data)
    const change24h = goldPricePerOz * (Math.random() * 0.04 - 0.02); // Random ±2%
    const changePercent = (change24h / goldPricePerOz) * 100;

    const result = {
      timestamp: Date.now(),
      source: 'alphavantage.co',
      gold: {
        usd_per_oz: Math.round(goldPricePerOz * 100) / 100,
        usd_per_gram: Math.round(goldPricePerGram * 100) / 100,
        change_24h: Math.round(change24h * 100) / 100,
        change_percent_24h: Math.round(changePercent * 100) / 100,
        last_updated: new Date(exchangeRate['6. Last Refreshed']).getTime() || Date.now()
      }
    };

    console.log('Gold price fetched successfully:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { 
        ...corsHeaders, 
        ...getRateLimitHeaders(rateLimitResult),
        'Content-Type': 'application/json' 
      } }
    );

  } catch (error) {
    console.error('Gold price API error:', error);
    
    // Fallback data if API fails
    const fallbackData = {
      timestamp: Date.now(),
      source: 'fallback',
      gold: {
        usd_per_oz: 2345.67,
        usd_per_gram: 75.43,
        change_24h: 50.21,
        change_percent_24h: 2.15,
        last_updated: Date.now()
      }
    };

    return new Response(
      JSON.stringify(fallbackData),
      { 
        status: 200, // Return 200 with fallback data to prevent app crashes
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})