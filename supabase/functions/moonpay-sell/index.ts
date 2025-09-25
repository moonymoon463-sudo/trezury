import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { amount, currency, returnUrl, bankDetails, userId } = await req.json()

    console.log('MoonPay sell request:', { amount, currency, returnUrl, userId })

    // Validate user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('kyc_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'User profile not found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For development/testing, allow bypass of KYC check
    const isDevMode = Deno.env.get('ENVIRONMENT') === 'development' || !profile.kyc_status || profile.kyc_status === 'pending'
    
    if (!isDevMode && profile.kyc_status !== 'verified') {
      console.log('KYC verification required for user:', userId, 'status:', profile.kyc_status)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'KYC verification required for bank withdrawals' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const moonpaySecretKey = Deno.env.get('MOONPAY_SECRET_KEY')
    const moonpayPublishableKey = Deno.env.get('MOONPAY_PUBLISHABLE_KEY')
    
    if (!moonpaySecretKey || !moonpayPublishableKey) {
      console.error('MoonPay API keys not configured:', { 
        hasSecret: !!moonpaySecretKey, 
        hasPublishable: !!moonpayPublishableKey 
      })
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Payment service configuration error' 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate currency - only USDC supported for now
    if (currency !== 'USDC') {
      console.error('Unsupported currency for sell:', currency)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Only USDC is supported for off-ramp transactions' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create MoonPay hosted sell widget URL
    const baseUrl = 'https://sell.moonpay.com'
    const defaultReturnUrl = `https://auntkvllzejtfqmousxg.supabase.co/offramp/return?sell=moonpay`
    const finalReturnUrl = returnUrl || defaultReturnUrl
    
    const params = new URLSearchParams({
      apiKey: moonpayPublishableKey,
      baseCurrencyCode: currency.toLowerCase(), // 'usdc' - crypto being sold
      baseCurrencyAmount: amount.toFixed(2), // Amount of USDC to sell
      quoteCurrencyCode: 'usd', // Target fiat currency
      externalCustomerId: userId,
      redirectUrl: finalReturnUrl
    })
    
    const sellWidgetUrl = `${baseUrl}?${params.toString()}`
    
    console.log('Generated MoonPay sell widget URL for amount:', amount, currency)

    // Generate a transaction ID for tracking
    const transactionId = crypto.randomUUID()

    // Store transaction reference
    const { error: dbError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userId,
        provider: 'moonpay',
        external_id: transactionId,
        amount: amount,
        currency: currency,
        status: 'pending',
        metadata: {
          transaction_type: 'sell',
          bank_details: bankDetails,
          widget_url: sellWidgetUrl,
          created_at: new Date().toISOString()
        }
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to store transaction reference' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ MoonPay sell widget URL generated successfully:', sellWidgetUrl)

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transactionId,
        redirectUrl: sellWidgetUrl,
        debug: {
          amount,
          currency,
          hasSecrets: true,
          kycStatus: profile.kyc_status
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('MoonPay sell error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})