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

    const { action } = await req.json()
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('User error:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🚀 MoonPay KYC request for user:', user.id)

    if (action === 'create-widget-url') {
      const moonpaySecretKey = Deno.env.get('MOONPAY_SECRET_KEY')
      if (!moonpaySecretKey) {
        console.error('MoonPay secret key not configured')
        return new Response(
          JSON.stringify({ error: 'KYC service temporarily unavailable' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get user profile for email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('Profile error:', profileError)
        return new Response(
          JSON.stringify({ error: 'User profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create MoonPay customer for KYC only
      const customerPayload = {
        email: profile.email,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        // KYC-only mode - no transaction required
        externalCustomerId: user.id,
      }

      console.log('Creating MoonPay customer for KYC:', customerPayload)

      const customerResponse = await fetch('https://api.moonpay.com/v3/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${moonpaySecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerPayload),
      })

      if (!customerResponse.ok) {
        const errorText = await customerResponse.text()
        console.error('MoonPay customer creation error:', errorText)
        
        // If customer already exists, try to get existing customer
        if (errorText.includes('email') && errorText.includes('taken')) {
          console.log('Customer already exists, proceeding with KYC URL generation')
        } else {
          return new Response(
            JSON.stringify({ error: 'Failed to create customer profile' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      let customerData = null
      if (customerResponse.ok) {
        customerData = await customerResponse.json()
        console.log('MoonPay customer created:', customerData.id)
      }

      // Generate KYC-only widget URL
      const baseUrl = 'https://buy.moonpay.com'
      const params = new URLSearchParams({
        apiKey: Deno.env.get('MOONPAY_PUBLISHABLE_KEY') || '',
        currencyCode: 'usdc', // Required even for KYC-only
        baseCurrencyCode: 'usd',
        baseCurrencyAmount: '1', // Minimal amount for KYC-only flow
        externalCustomerId: user.id,
        redirectURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/moonpay-webhook`,
        // KYC-specific parameters
        showWalletAddressForm: 'false',
        skipWalletAddressForm: 'true',
        walletAddressRequired: 'false',
        // Force KYC flow
        kycRequired: 'true',
        // Return URLs
        successUrl: `${req.headers.get('origin') || 'https://localhost:8080'}/kyc-verification?status=success`,
        failureUrl: `${req.headers.get('origin') || 'https://localhost:8080'}/kyc-verification?status=failed`,
      })

      const widgetUrl = `${baseUrl}?${params.toString()}`

      console.log('Generated MoonPay KYC widget URL')

      // Update profile with pending KYC status
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          kyc_status: 'pending',
          kyc_submitted_at: new Date().toISOString(),
          metadata: {
            moonpay_customer_id: customerData?.id,
            kyc_flow: 'moonpay'
          }
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Failed to update profile KYC status:', updateError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          widgetUrl,
          customerId: customerData?.id,
          debug: {
            userId: user.id,
            email: profile.email,
            kycFlow: 'moonpay'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('MoonPay KYC error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})