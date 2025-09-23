import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse the request body first to determine the action
    const body = await req.json()
    const { action } = body

    if (action === 'create-inquiry') {
      // Require authentication for creating inquiries
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization header required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // Create Persona inquiry
      const personaApiKey = Deno.env.get('PERSONA_API_KEY')
      if (!personaApiKey) {
        throw new Error('Persona API key not configured')
      }

      const origin = req.headers.get('origin') || Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('SUPABASE_URL') || 'https://auntkvllzejtfqmousxg.supabase.co'
      const personaTemplateId = Deno.env.get('PERSONA_TEMPLATE_ID') || 'vtmpl_pzdkyd7DtaPNNBxus5mvaVJ5qpJf'
      // Fix: Persona verification templates use 'vitmpl_' prefix (with 'i')
      const templateKey = personaTemplateId.startsWith('vitmpl_') ? 'verification-template-id' : 'inquiry-template-id'
      console.log('Creating Persona inquiry with template', { templateKey, personaTemplateId })

      const personaResponse = await fetch('https://withpersona.com/api/v1/inquiries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${personaApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Persona-Version': '2023-01-05'
        },
        body: JSON.stringify({
          data: {
            type: 'inquiry',
            attributes: {
              [templateKey]: personaTemplateId,
              'reference-id': user.id,
              'redirect-uri': `${origin}/kyc-verification`
            }
          }
        })
      })

      if (!personaResponse.ok) {
        const errorText = await personaResponse.text()
        console.error('Persona API error response:', {
          status: personaResponse.status,
          statusText: personaResponse.statusText,
          body: errorText
        })
        return new Response(
          JSON.stringify({ 
            error: 'PERSONA_CREATE_INQUIRY_FAILED', 
            status: personaResponse.status, 
            details: errorText 
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const personaData = await personaResponse.json()
      const inquiryData = personaData.data
      
      console.log('Persona inquiry created successfully:', {
        inquiryId: inquiryData.id,
        hasUrl: !!inquiryData.attributes.url,
        hasSessionToken: !!inquiryData.attributes['session-token']
      })

      // Store inquiry ID in our database
      await supabaseClient
        .from('profiles')
        .update({ 
          kyc_inquiry_id: inquiryData.id,
          kyc_status: 'pending',
          kyc_submitted_at: new Date().toISOString()
        })
        .eq('id', user.id)

      // Build the verification URL
      let verificationUrl = inquiryData.attributes.url
      if (!verificationUrl && inquiryData.attributes['session-token']) {
        verificationUrl = `https://withpersona.com/verify?inquiry-id=${inquiryData.id}&inquiry-session-token=${inquiryData.attributes['session-token']}`
      }

      return new Response(
        JSON.stringify({
          success: true,
          inquiryId: inquiryData.id,
          sessionToken: inquiryData.attributes['session-token'],
          url: verificationUrl
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'webhook') {
      // Handle Persona webhook - no authentication required
      const { data } = body
      
      if (data.type === 'inquiry' && data.attributes) {
        const referenceId = data.attributes['reference-id']
        const status = data.attributes.status
        const inquiryId = data.id

        let kycStatus = 'pending'
        let verifiedAt = null

        switch (status) {
          case 'completed':
            kycStatus = 'verified'
            verifiedAt = new Date().toISOString()
            break
          case 'failed':
          case 'declined':
            kycStatus = 'rejected'
            break
          case 'expired':
            kycStatus = 'expired'
            break
        }

        // Update user profile with verification result
        await supabaseClient
          .from('profiles')
          .update({
            kyc_status: kycStatus,
            kyc_verified_at: verifiedAt,
            kyc_inquiry_id: inquiryId,
            updated_at: new Date().toISOString()
          })
          .eq('id', referenceId)

        // Log the verification event
        await supabaseClient
          .from('audit_log')
          .insert({
            user_id: referenceId,
            table_name: 'profiles',
            operation: 'KYC_VERIFICATION',
            metadata: {
              inquiry_id: inquiryId,
              status: kycStatus,
              persona_status: status
            }
          })
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Error in persona-kyc function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})