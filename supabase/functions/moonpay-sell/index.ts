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

    // Create MoonPay off-ramp transaction using the sell widget
    const baseUrl = 'https://sell.moonpay.com'
    const params = new URLSearchParams({
      apiKey: Deno.env.get('MOONPAY_PUBLISHABLE_KEY') || '',
      baseCurrencyCode: currency.toLowerCase(),
      baseCurrencyAmount: amount.toString(),
      quoteCurrencyCode: 'usd',
      externalCustomerId: userId,
      redirectUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/moonpay-webhook`,
      ...(bankDetails && {
        bankAccountNumber: bankDetails.accountNumber,
        bankRoutingNumber: bankDetails.routingNumber,
        bankAccountType: bankDetails.accountType,
        bankName: bankDetails.bankName
      })
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
        JSON.stringify({ error: 'Failed to store transaction reference' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ MoonPay sell widget URL generated successfully')

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transactionId,
        redirectUrl: sellWidgetUrl,
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