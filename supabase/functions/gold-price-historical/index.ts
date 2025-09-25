import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface YahooHistoricalResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string
        currency: string
        regularMarketPrice: number
      }
      timestamp: number[]
      indicators: {
        quote: Array<{
          open: number[]
          high: number[]
          low: number[]
          close: number[]
          volume: number[]
        }>
      }
    }>
    error?: {
      code: string
      description: string
    }
  }
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

    console.log('Starting historical gold price collection...')

    // Fetch historical data from Yahoo Finance (2 years of daily data)
    // Using XAUUSD=X symbol for spot gold prices
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD%3DX?range=2y&interval=1d&includePrePost=false&events=div%2Csplit`
    
    console.log('Fetching from Yahoo Finance:', yahooUrl)
    
    const response = await fetch(yahooUrl)
    const data: YahooHistoricalResponse = await response.json()

    if (data.chart.error) {
      console.error('Yahoo Finance API error:', data.chart.error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.chart.error.description || 'Yahoo Finance API error'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result = data.chart.result?.[0]
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      console.error('No historical data received from Yahoo Finance')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No historical data available from Yahoo Finance'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const timestamps = result.timestamp
    const quote = result.indicators.quote[0]
    const { open, high, low, close } = quote

    console.log(`Processing ${timestamps.length} historical data points...`)

    // Convert and insert historical data
    const historicalData = []
    let insertedCount = 0
    let skippedCount = 0

    for (let i = 0; i < timestamps.length; i++) {
      try {
        // Convert timestamp to date string
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0]
        
        // Skip if any OHLC value is null
        if (open[i] == null || high[i] == null || low[i] == null || close[i] == null) {
          skippedCount++
          continue
        }

        const historicalEntry = {
          date: date,
          open_price: open[i],
          high_price: high[i],
          low_price: low[i],
          close_price: close[i],
          volume: 0,
          source: 'yahoo_finance'
        }

        // Insert into database with conflict handling
        const { error } = await supabase
          .from('gold_price_history')
          .upsert(historicalEntry, {
            onConflict: 'date,source',
            ignoreDuplicates: true
          })

        if (error) {
          console.error(`Error inserting data for ${date}:`, error)
          skippedCount++
        } else {
          insertedCount++
        }

        historicalData.push(historicalEntry)
      } catch (err) {
        console.error(`Error processing data point ${i}:`, err)
        skippedCount++
      }
    }

    console.log(`Historical data collection complete: ${insertedCount} inserted, ${skippedCount} skipped`)

    // Also update current price if we have recent data
    const latestIndex = timestamps.length - 1
    const latestTimestamp = timestamps[latestIndex]
    const latestDate = new Date(latestTimestamp * 1000).toISOString().split('T')[0]

    if (close[latestIndex] != null) {
      const currentPrice = close[latestIndex]
      const previousPrice = latestIndex > 0 && close[latestIndex - 1] != null ? close[latestIndex - 1] : currentPrice
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
          source: 'yahoo_finance_historical',
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
          total_processed: timestamps.length,
          inserted: insertedCount,
          skipped: skippedCount,
          latest_date: latestDate,
          latest_price: close[latestIndex]
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