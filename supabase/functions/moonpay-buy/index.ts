import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, createRateLimitResponse, getRateLimitHeaders } from '../_shared/rateLimiter.ts';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { amount, currency, walletAddress, userId, returnUrl } = await req.json()

    console.log('MoonPay buy request:', { amount, currency, walletAddress, userId })
    
    // Rate limiting: 50 requests per minute per user
    const rateLimitResult = await checkRateLimit(
      supabaseUrl,
      supabaseKey,
      userId,
      'moonpay-buy',
      50, // max requests
      60000 // 1 minute window
    );

    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for user: ${userId}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }
    
    // Get user's wallet address if not provided
    let finalWalletAddress = walletAddress
    if (!finalWalletAddress) {
      // Query user's stored wallet address from onchain_addresses table
      const { data: addresses } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .limit(1)
      
      if (addresses && addresses.length > 0) {
        finalWalletAddress = addresses[0].address
        console.log('Retrieved stored wallet address:', finalWalletAddress)
      }
    }

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

    // Create MoonPay transaction
    const moonpayResponse = await fetch('https://api.moonpay.com/v3/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${moonpaySecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        baseCurrencyAmount: amount,
        baseCurrencyCode: currency.toLowerCase(),
        currencyCode: 'usdc',
        walletAddress: finalWalletAddress,
        redirectURL: returnUrl || 'https://auntkvllzejtfqmousxg.lovable.app/buy-gold-success',
        externalCustomerId: userId,
      }),
    })

    if (!moonpayResponse.ok) {
      const errorText = await moonpayResponse.text()
      console.error('MoonPay API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const moonpayData = await moonpayResponse.json()
    console.log('MoonPay transaction created:', moonpayData.id)

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
        metadata: moonpayData
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
      { headers: { 
        ...corsHeaders, 
        ...getRateLimitHeaders(rateLimitResult),
        'Content-Type': 'application/json' 
      } }
    )

  } catch (error) {
    console.error('MoonPay buy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})