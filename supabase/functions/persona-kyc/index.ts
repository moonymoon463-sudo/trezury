import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    // Auth
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { action } = await req.json().catch(() => ({ action: null }))
    
    if (action === 'create-inquiry') {
      // Config
      const personaApiKey = Deno.env.get('PERSONA_API_KEY')
      const personaTemplateId = Deno.env.get('PERSONA_TEMPLATE_ID') || ''
      if (!personaApiKey) throw new Error('PERSONA_API_KEY not configured')
      if (!personaTemplateId) throw new Error('PERSONA_TEMPLATE_ID not configured')

      const origin =
        req.headers.get('origin') ??
        Deno.env.get('PUBLIC_APP_URL') ??
        Deno.env.get('SUPABASE_URL') ??
        'https://example.com'

      // Correct prefix check: vitmpl_ => verification-template-id
      const templateKey = personaTemplateId.startsWith('vitmpl_')
        ? 'verification-template-id'
        : 'inquiry-template-id'

      const payload = {
        data: {
          type: 'inquiry',
          attributes: {
            [templateKey]: personaTemplateId,
            'reference-id': user.id,
            'redirect-uri': `${origin}/kyc-verification`
          }
        }
      }

      const res = await fetch('https://withpersona.com/api/v1/inquiries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${personaApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Persona-Version': '2023-01-05'
        },
        body: JSON.stringify(payload)
      })

      const text = await res.text()
      if (!res.ok) {
        console.error('Persona error', res.status, text)
        return new Response(JSON.stringify({
          error: 'PERSONA_CREATE_INQUIRY_FAILED',
          status: res.status,
          body: text
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const data = JSON.parse(text)
      const inquiry = data.data
      const attrs = inquiry?.attributes ?? {}

      // Persist on our side
      await supabase
        .from('profiles')
        .update({
          kyc_inquiry_id: inquiry.id,
          kyc_status: 'pending',
          kyc_submitted_at: new Date().toISOString()
        })
        .eq('id', user.id)

      // Build URL fallback from session token
      let url = attrs.url
      if (!url && attrs['session-token']) {
        url = `https://withpersona.com/verify?inquiry-id=${inquiry.id}&inquiry-session-token=${attrs['session-token']}`
      }

      return new Response(JSON.stringify({
        success: true,
        inquiryId: inquiry.id,
        sessionToken: attrs['session-token'] ?? null,
        url: url ?? null
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'webhook') {
      // Handle Persona webhook - no authentication required for webhooks
      const supabaseService = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { data } = await req.json()
      
      console.log('Webhook received:', JSON.stringify(data, null, 2))
      
      if (data.type === 'inquiry' && data.attributes) {
        const referenceId = data.attributes['reference-id']
        const status = data.attributes.status
        const inquiryId = data.id

        console.log('Processing webhook for inquiry:', {
          inquiryId,
          referenceId,
          status
        })

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
        const { error: updateError } = await supabaseService
          .from('profiles')
          .update({
            kyc_status: kycStatus,
            kyc_verified_at: verifiedAt
          })
          .eq('kyc_inquiry_id', inquiryId)

        if (updateError) {
          console.error('Failed to update profile:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update profile' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`Successfully updated KYC status: ${kycStatus}`)
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('persona-kyc fatal', e?.message || e)
    return new Response(JSON.stringify({ error: 'Internal server error', detail: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})