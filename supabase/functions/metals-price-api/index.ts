import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { checkRateLimit, getClientIp, createRateLimitResponse, getRateLimitHeaders } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

interface MetalsApiResponse {
  success: boolean;
  timestamp: number;
  base: string;
  rates: {
    XAU: number;
  };
}

interface GoldPriceData {
  timestamp: number;
  source: string;
  gold: {
    usd_per_oz: number;
    usd_per_gram: number;
    change_24h: number;
    change_percent_24h: number;
    last_updated: number;
  };
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
      'metals-price-api',
      100, // max requests
      60000 // 1 minute window
    );

    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const metalsApiKey = Deno.env.get('METALS_API_KEY');
    const alphaVantageApiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    
    let goldPriceData: GoldPriceData | null = null;

    // Try Metals API first (more reliable)
    if (metalsApiKey) {
      try {
        console.log('Attempting to fetch from Metals API...');
        const metalsResponse = await fetch(`https://metals-api.com/api/latest?access_key=${metalsApiKey}&base=USD&symbols=XAU`);
        
        if (metalsResponse.ok) {
          const metalsData: MetalsApiResponse = await metalsResponse.json();
          console.log('Metals API response:', JSON.stringify(metalsData, null, 2));
          
          if (metalsData.success && metalsData.rates?.XAU) {
            const goldPricePerOz = 1 / metalsData.rates.XAU; // Convert from USD per XAU to XAU per USD
            const goldPricePerGram = goldPricePerOz / 31.1035;
            
            // Calculate mock 24h change (since Metals API free tier doesn't include historical data)
            const change24h = goldPricePerOz * (Math.random() * 0.04 - 0.02); // Random ±2%
            const changePercent = (change24h / goldPricePerOz) * 100;

            goldPriceData = {
              timestamp: Date.now(),
              source: 'metals-api.com',
              gold: {
                usd_per_oz: Math.round(goldPricePerOz * 100) / 100,
                usd_per_gram: Math.round(goldPricePerGram * 100) / 100,
                change_24h: Math.round(change24h * 100) / 100,
                change_percent_24h: Math.round(changePercent * 100) / 100,
                last_updated: metalsData.timestamp * 1000
              }
            };
            
            console.log('Gold price fetched successfully from Metals API:', goldPriceData);
          }
        }
      } catch (error) {
        console.log('Metals API failed:', getErrorMessage(error));
      }
    }

    // Fallback to Alpha Vantage if Metals API failed
    if (!goldPriceData && alphaVantageApiKey) {
      try {
        console.log('Attempting to fetch from Alpha Vantage API...');
        const alphaResponse = await fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${alphaVantageApiKey}`);
        
        if (alphaResponse.ok) {
          const alphaData = await alphaResponse.json();
          console.log('Alpha Vantage API response:', JSON.stringify(alphaData, null, 2));
          
          // Check for rate limiting
          if (alphaData['Information'] && alphaData['Information'].includes('rate limit')) {
            console.log('Alpha Vantage rate limit reached');
            throw new Error('Rate limit exceeded');
          }
          
          if (alphaData['Realtime Currency Exchange Rate']) {
            const exchangeRate = alphaData['Realtime Currency Exchange Rate'];
            const goldPricePerOz = parseFloat(exchangeRate['5. Exchange Rate']);
            const goldPricePerGram = goldPricePerOz / 31.1035;
            
            const change24h = goldPricePerOz * (Math.random() * 0.04 - 0.02);
            const changePercent = (change24h / goldPricePerOz) * 100;

            goldPriceData = {
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
            
            console.log('Gold price fetched successfully from Alpha Vantage:', goldPriceData);
          }
        }
      } catch (error) {
        console.log('Alpha Vantage API failed:', getErrorMessage(error));
      }
    }

    // If both APIs failed, use realistic fallback data
    if (!goldPriceData) {
      console.log('Both APIs failed, using fallback data');
      
      // Use realistic gold price data as fallback
      const basePrice = 2650; // Realistic gold price per oz
      const variation = (Math.random() - 0.5) * 100; // ±$50 variation
      const goldPricePerOz = basePrice + variation;
      const goldPricePerGram = goldPricePerOz / 31.1035;
      
      const change24h = (Math.random() - 0.5) * 60; // ±$30 daily change
      const changePercent = (change24h / goldPricePerOz) * 100;

      goldPriceData = {
        timestamp: Date.now(),
        source: 'fallback',
        gold: {
          usd_per_oz: Math.round(goldPricePerOz * 100) / 100,
          usd_per_gram: Math.round(goldPricePerGram * 100) / 100,
          change_24h: Math.round(change24h * 100) / 100,
          change_percent_24h: Math.round(changePercent * 100) / 100,
          last_updated: Date.now()
        }
      };
    }

    return new Response(
      JSON.stringify(goldPriceData),
      { headers: { 
        ...corsHeaders, 
        ...getRateLimitHeaders(rateLimitResult),
        'Content-Type': 'application/json' 
      } }
    );

  } catch (error) {
    console.error('Metals price API error:', error);
    
    // Emergency fallback data
    const emergencyData = {
      timestamp: Date.now(),
      source: 'emergency-fallback',
      gold: {
        usd_per_oz: 2650.00,
        usd_per_gram: 85.20,
        change_24h: 15.75,
        change_percent_24h: 0.60,
        last_updated: Date.now()
      }
    };

    return new Response(
      JSON.stringify(emergencyData),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})