import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AlphaVantageResponse {
  'Time Series (Daily)'?: {
    [date: string]: {
      '1. open': string
      '2. high': string
      '3. low': string
      '4. close': string
      '5. volume': string
    }
  }
  'Error Message'?: string
  Note?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Alpha Vantage API key
    const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY')
    if (!alphaVantageKey) {
      throw new Error('Alpha Vantage API key not configured')
    }

    console.log('Starting historical gold price collection...')

    // Fetch historical data from Alpha Vantage
    // Using GOLD symbol for daily gold prices in USD
    const alphaVantageUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=GOLD&apikey=${alphaVantageKey}&outputsize=full`
    
    console.log('Fetching from Alpha Vantage:', alphaVantageUrl.replace(alphaVantageKey, 'HIDDEN'))
    
    const response = await fetch(alphaVantageUrl)
    const data: AlphaVantageResponse = await response.json()

    if (data['Error Message'] || data.Note) {
      console.error('Alpha Vantage API error:', data['Error Message'] || data.Note)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data['Error Message'] || data.Note || 'API limit reached'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const timeSeries = data['Time Series (Daily)']
    if (!timeSeries) {
      console.error('No time series data received from Alpha Vantage')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No historical data available from Alpha Vantage'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Processing ${Object.keys(timeSeries).length} historical data points...`)

    // Convert and insert historical data
    const historicalData = []
    let insertedCount = 0
    let skippedCount = 0

    for (const [dateStr, values] of Object.entries(timeSeries)) {
      try {
        const historicalEntry = {
          date: dateStr,
          open_price: parseFloat(values['1. open']),
          high_price: parseFloat(values['2. high']),
          low_price: parseFloat(values['3. low']),
          close_price: parseFloat(values['4. close']),
          volume: parseInt(values['5. volume']) || 0,
          source: 'alpha_vantage'
        }

        // Insert into database with conflict handling
        const { error } = await supabase
          .from('gold_price_history')
          .upsert(historicalEntry, {
            onConflict: 'date,source',
            ignoreDuplicates: true
          })

        if (error) {
          console.error(`Error inserting data for ${dateStr}:`, error)
          skippedCount++
        } else {
          insertedCount++
        }

        historicalData.push(historicalEntry)
      } catch (err) {
        console.error(`Error processing data for ${dateStr}:`, err)
        skippedCount++
      }
    }

    console.log(`Historical data collection complete: ${insertedCount} inserted, ${skippedCount} skipped`)

    // Also update current price if we have recent data
    const sortedDates = Object.keys(timeSeries).sort().reverse()
    const latestDate = sortedDates[0]
    const latestData = timeSeries[latestDate]

    if (latestData) {
      const currentPrice = parseFloat(latestData['4. close'])
      const previousPrice = sortedDates[1] ? parseFloat(timeSeries[sortedDates[1]]['4. close']) : currentPrice
      const change24h = currentPrice - previousPrice
      const changePercent24h = previousPrice > 0 ? (change24h / previousPrice) * 100 : 0

      // Insert current price data
      const { error: currentPriceError } = await supabase
        .from('gold_prices')
        .insert({
          usd_per_oz: currentPrice,
          usd_per_gram: currentPrice / 31.1035, // Convert to per gram
          change_24h: change24h,
          change_percent_24h: changePercent24h,
          source: 'alpha_vantage_historical',
          metadata: {
            latest_historical_date: latestDate,
            collection_type: 'historical_backfill'
          }
        })

      if (currentPriceError) {
        console.error('Error updating current price:', currentPriceError)
      } else {
        console.log('Updated current price from historical data')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Historical gold price data collected successfully',
        data: {
          total_processed: Object.keys(timeSeries).length,
          inserted: insertedCount,
          skipped: skippedCount,
          latest_date: latestDate,
          latest_price: latestData ? parseFloat(latestData['4. close']) : null
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in historical data collection:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})