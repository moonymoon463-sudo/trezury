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

    const { amount, currency, bankDetails, userId } = await req.json()

    console.log('MoonPay sell request:', { amount, currency, userId })

    // Validate user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('kyc_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (profile.kyc_status !== 'verified') {
      return new Response(
        JSON.stringify({ error: 'KYC verification required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const moonpaySecretKey = Deno.env.get('MOONPAY_SECRET_KEY')
    if (!moonpaySecretKey) {
      console.error('MoonPay secret key not configured')
      return new Response(
        JSON.stringify({ error: 'Payment service temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create MoonPay sell transaction
    const moonpayResponse = await fetch('https://api.moonpay.com/v3/transactions/sell', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${moonpaySecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        baseCurrencyAmount: amount,
        baseCurrencyCode: currency.toLowerCase(),
        quoteCurrencyCode: 'usd',
        bankAccount: bankDetails,
        redirectURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/moonpay-webhook`,
        externalCustomerId: userId,
      }),
    })

    if (!moonpayResponse.ok) {
      const errorText = await moonpayResponse.text()
      console.error('MoonPay API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create sell transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const moonpayData = await moonpayResponse.json()
    console.log('MoonPay sell transaction created:', moonpayData.id)

    // Store transaction reference
    const { error: dbError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userId,
        provider: 'moonpay',
        external_id: moonpayData.id,
        amount: amount,
        currency: currency,
        status: 'pending',
        metadata: {
          ...moonpayData,
          transaction_type: 'sell',
          bank_details: bankDetails
        }
      })

    if (dbError) {
      console.error('Database error:', dbError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: moonpayData.id,
        redirectUrl: moonpayData.redirectUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('MoonPay sell error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})