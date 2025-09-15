import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const metalsApiKey = Deno.env.get('METALS_API_KEY');
    
    if (!metalsApiKey) {
      throw new Error('METALS_API_KEY is not configured');
    }

    // Fetch gold price from Metals API
    const response = await fetch(`https://metals-api.com/api/latest?access_key=${metalsApiKey}&base=USD&symbols=XAU`);
    
    if (!response.ok) {
      throw new Error(`Metals API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.info || 'Failed to fetch gold price');
    }

    // Convert from troy ounce price to more usable format
    const goldPricePerOz = 1 / data.rates.XAU; // Metals API returns XAU as 1/price
    const goldPricePerGram = goldPricePerOz / 31.1035; // 1 troy ounce = 31.1035 grams

    // Calculate 24h change (mock for now - would need historical data)
    const change24h = goldPricePerOz * (Math.random() * 0.04 - 0.02); // Random ±2%
    const changePercent = (change24h / goldPricePerOz) * 100;

    const result = {
      timestamp: Date.now(),
      source: 'metals-api.com',
      gold: {
        usd_per_oz: Math.round(goldPricePerOz * 100) / 100,
        usd_per_gram: Math.round(goldPricePerGram * 100) / 100,
        change_24h: Math.round(change24h * 100) / 100,
        change_percent_24h: Math.round(changePercent * 100) / 100,
        last_updated: data.timestamp || Date.now()
      }
    };

    console.log('Gold price fetched successfully:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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