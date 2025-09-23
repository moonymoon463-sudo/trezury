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

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, inquiryId, status } = await req.json()

    if (action === 'create-inquiry') {
      // Create Persona inquiry
      const personaApiKey = Deno.env.get('PERSONA_API_KEY')
      if (!personaApiKey) {
        throw new Error('Persona API key not configured')
      }

      const personaResponse = await fetch('https://withpersona.com/api/v1/inquiries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${personaApiKey}`,
          'Content-Type': 'application/json',
          'Persona-Version': '2023-01-05'
        },
        body: JSON.stringify({
          data: {
            type: 'inquiry',
            attributes: {
              'verification-template-id': Deno.env.get('PERSONA_TEMPLATE_ID') || 'vtmpl_pzdkyd7DtaPNNBxus5mvaVJ5qpJf',
              'reference-id': user.id,
              'redirect-uri': `${req.headers.get('origin')}/kyc-complete`
            }
          }
        })
      })

      if (!personaResponse.ok) {
        const error = await personaResponse.text()
        console.error('Persona API error:', error)
        throw new Error('Failed to create Persona inquiry')
      }

      const personaData = await personaResponse.json()
      const inquiryData = personaData.data

      // Store inquiry ID in our database
      await supabaseClient
        .from('profiles')
        .update({ 
          kyc_inquiry_id: inquiryData.id,
          kyc_status: 'pending',
          kyc_submitted_at: new Date().toISOString()
        })
        .eq('id', user.id)

      return new Response(
        JSON.stringify({
          success: true,
          inquiryId: inquiryData.id,
          sessionToken: inquiryData.attributes['session-token'],
          url: inquiryData.attributes.url
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'webhook') {
      // Handle Persona webhook
      const { data } = await req.json()
      
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