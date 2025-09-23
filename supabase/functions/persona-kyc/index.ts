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
      // Config & Environment Variable Debugging
      const personaApiKey = Deno.env.get('PERSONA_API_KEY')
      const personaTemplateId = Deno.env.get('PERSONA_TEMPLATE_ID') || ''
      
      console.log('🔧 Environment Variables Check:', {
        hasApiKey: !!personaApiKey,
        apiKeyPrefix: personaApiKey ? `${personaApiKey.slice(0, 8)}...` : 'MISSING',
        templateId: personaTemplateId || 'MISSING',
        templateIdLength: personaTemplateId?.length || 0
      })
      
      if (!personaApiKey) throw new Error('PERSONA_API_KEY not configured')
      if (!personaTemplateId) throw new Error('PERSONA_TEMPLATE_ID not configured')

      const origin =
        req.headers.get('origin') ??
        Deno.env.get('PUBLIC_APP_URL') ??
        Deno.env.get('SUPABASE_URL') ??
        'https://example.com'

      // Template ID Analysis & Dynamic Template Key Selection
      const isVerificationTemplate = personaTemplateId.startsWith('vitmpl_')
      const isInquiryTemplate = personaTemplateId.startsWith('itmpl_')
      const templateKey = isVerificationTemplate ? 'verification-template-id' : 'inquiry-template-id'
      
      console.log('🎯 Template Analysis:', {
        templateId: personaTemplateId,
        isVerificationTemplate,
        isInquiryTemplate,
        selectedTemplateKey: templateKey,
        templateFormat: personaTemplateId.slice(0, 6) + '...'
      })

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
      
      console.log('📦 Persona API Request Payload:', {
        endpoint: 'https://withpersona.com/api/v1/inquiries',
        method: 'POST',
        templateKey,
        templateId: personaTemplateId,
        referenceId: user.id,
        redirectUri: `${origin}/kyc-verification`,
        fullPayload: JSON.stringify(payload, null, 2)
      })

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
      console.log('📡 Persona API Response Details:', {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        bodyLength: text?.length || 0,
        bodyPreview: text?.slice(0, 200) + (text?.length > 200 ? '...' : ''),
        fullBody: text
      })
      
      if (!res.ok) {
        console.error('❌ Persona API Error:', {
          status: res.status,
          statusText: res.statusText,
          errorBody: text,
          templateUsed: templateKey,
          templateId: personaTemplateId
        })
        return new Response(JSON.stringify({
          error: 'PERSONA_CREATE_INQUIRY_FAILED',
          status: res.status,
          body: text,
          templateDebug: { templateKey, templateId: personaTemplateId }
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const data = JSON.parse(text)
      const inquiry = data.data
      const attrs = inquiry?.attributes ?? {}
      
      console.log('✅ Persona API Success - Full Response Analysis:', {
        inquiryId: inquiry?.id,
        inquiryType: inquiry?.type,
        hasUrl: !!attrs.url,
        hasSessionToken: !!attrs['session-token'],
        url: attrs.url || 'NOT_PROVIDED',
        sessionToken: attrs['session-token'] ? `${attrs['session-token'].slice(0, 10)}...` : 'NOT_PROVIDED',
        allAttributes: Object.keys(attrs),
        fullInquiryObject: inquiry,
        templateUsedSuccessfully: templateKey
      })

      // Persist inquiry in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          kyc_inquiry_id: inquiry.id,
          kyc_status: 'pending',
          kyc_submitted_at: new Date().toISOString()
        })
        .eq('id', user.id)
        
      if (updateError) {
        console.error('❌ Database update failed:', updateError)
      } else {
        console.log('✅ Database updated successfully with inquiry ID:', inquiry.id)
      }

      // Enhanced URL/Session handling with Resume fallback
      let url = attrs.url
      let sessionToken = attrs['session-token']
      const inquiryId = inquiry.id
      
      console.log('🔗 URL Construction Analysis (pre-resume):', {
        providedUrl: url || 'NONE',
        hasSessionToken: !!sessionToken,
        inquiryId,
        willAttemptResume: !url && !sessionToken && !!inquiryId
      })

      // If no URL or session token returned, try to get session token via Sessions API
      if (!url && !sessionToken && inquiryId) {
        console.log('🎫 No session token found, attempting to create session via Sessions API')
        
        // First try Resume API for session token (check meta object)
        const resumeEndpoint = `https://withpersona.com/api/v1/inquiries/${inquiryId}/resume`
        console.log('⏯️ Attempting Persona Resume API:', resumeEndpoint)
        const resumeRes = await fetch(resumeEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${personaApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Persona-Version': '2023-01-05'
          },
          body: JSON.stringify({})
        })
        const resumeText = await resumeRes.text()
        console.log('📡 Persona Resume Response:', {
          status: resumeRes.status,
          statusText: resumeRes.statusText,
          bodyPreview: resumeText?.slice(0, 200) + (resumeText?.length > 200 ? '...' : '')
        })
        
        if (resumeRes.ok) {
          try {
            const resumeData = JSON.parse(resumeText)
            // Check multiple possible locations for session token
            sessionToken = resumeData?.data?.meta?.['session-token'] || 
                          resumeData?.data?.attributes?.['session-token'] || 
                          resumeData?.meta?.['session-token'] || 
                          resumeData?.['session-token'] || null
            console.log('✅ Resume parsed sessionToken:', sessionToken || 'NONE')
          } catch (e) {
            console.error('❌ Failed to parse resume response JSON:', e)
          }
        }

        // If Resume didn't work, try Sessions API
        if (!sessionToken) {
          console.log('🎫 Resume failed, trying Sessions API...')
          const sessionsEndpoint = `https://withpersona.com/api/v1/inquiries/${inquiryId}/sessions`
          const sessionsRes = await fetch(sessionsEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${personaApiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Persona-Version': '2023-01-05'
            },
            body: JSON.stringify({})
          })
          
          const sessionsText = await sessionsRes.text()
          console.log('📡 Persona Sessions Response:', {
            status: sessionsRes.status,
            statusText: sessionsRes.statusText,
            bodyPreview: sessionsText?.slice(0, 200) + (sessionsText?.length > 200 ? '...' : '')
          })
          
          if (sessionsRes.ok) {
            try {
              const sessionsData = JSON.parse(sessionsText)
              sessionToken = sessionsData?.data?.attributes?.['session-token'] || 
                           sessionsData?.data?.['session-token'] || 
                           sessionsData?.['session-token'] || null
              console.log('✅ Sessions parsed sessionToken:', sessionToken || 'NONE')
            } catch (e) {
              console.error('❌ Failed to parse sessions response JSON:', e)
            }
          }
        }
      }

      // Build URL if we have a session token now
      if (!url && sessionToken && inquiryId) {
        url = `https://withpersona.com/verify?inquiry-id=${inquiryId}&inquiry-session-token=${sessionToken}`
        console.log('🔄 Constructed Hosted Flow URL:', url)
      } else if (!url && !sessionToken) {
        console.error('❌ No URL or session token available for redirect')
      }

      const finalResponse = {
        success: true,
        inquiryId: inquiryId,
        sessionToken: sessionToken ?? null,
        url: url ?? null,
        debug: {
          templateKey,
          templateId: personaTemplateId,
          hasOriginalUrl: !!attrs.url,
          usedFallbackUrl: !attrs.url && !!url,
          usedResume: !attrs.url && !attrs['session-token'],
          sessionTokenSource: sessionToken ? (attrs['session-token'] ? 'original' : 'api_call') : 'none',
          allAvailableAttributes: Object.keys(attrs)
        }
      }
      
      console.log('🎉 Final Response Being Sent:', finalResponse)

      return new Response(JSON.stringify(finalResponse), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
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