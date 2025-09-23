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

      // Generate KYC identity verification widget URL
      // MoonPay handles customer creation internally through the widget
      console.log('Generating MoonPay identity verification widget for user:', user.id)
      
      const baseUrl = 'https://buy.moonpay.com'
      const params = new URLSearchParams({
        apiKey: Deno.env.get('MOONPAY_PUBLISHABLE_KEY') || '',
        // Use identity verification mode
        flow: 'identity_verification',
        externalCustomerId: user.id,
        email: profile.email,
        // Webhook for status updates
        webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/moonpay-webhook`,
        // Return URLs after verification
        redirectUrl: `${req.headers.get('origin') || 'https://localhost:3000'}/kyc-verification?status=completed`,
        cancelUrl: `${req.headers.get('origin') || 'https://localhost:3000'}/kyc-verification?status=cancelled`,
        // Pre-fill user data if available
        ...(profile.first_name && { firstName: profile.first_name }),
        ...(profile.last_name && { lastName: profile.last_name }),
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
            kyc_flow: 'moonpay',
            verification_started_at: new Date().toISOString()
          }
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Failed to update profile KYC status:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update verification status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ KYC widget URL generated successfully')

      return new Response(
        JSON.stringify({
          success: true,
          widgetUrl,
          debug: {
            userId: user.id,
            email: profile.email,
            kycFlow: 'moonpay',
            widgetMode: 'identity_verification'
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