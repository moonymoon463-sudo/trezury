import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function usePersonaKYC() {
  const [loading, setLoading] = useState(false)

  const openPersonaWidget = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No session')

      console.log('🚀 Starting Persona KYC flow...')
      console.log('🔧 Client-side debug info:', {
        hasSession: !!session?.access_token,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.slice(0, 50) + '...'
      })
      
      const { data, error } = await supabase.functions.invoke('persona-kyc', {
        body: { action: 'create-inquiry' },
        headers: { Authorization: `Bearer ${session.access_token}` }
      })

      console.log('📡 Persona API response:', { data, error })

      if (error) {
        console.error('❌ Persona API error:', error)
        throw error
      }
      
      if (!data?.url && !data?.sessionToken) {
        console.error('❌ Missing URL/token in response:', data)
        throw new Error('No URL or session token returned from Persona')
      }

      console.log('✅ Persona response valid:', {
        hasUrl: !!data.url,
        hasSessionToken: !!data.sessionToken,
        inquiryId: data.inquiryId
      })

      // Prefer URL; fallback to alternative URLs if connection fails
      if (data.url) {
        console.log('🔄 Redirecting to Persona URL:', data.url)
        console.log('🔧 Debug info:', data.debug)
        
        // Try primary URL first
        try {
          window.location.href = data.url
        } catch (error) {
          console.error('❌ Primary URL failed:', error)
          
          // Try alternative URLs if available
          const alternatives = data.debug?.connectionTroubleshooting?.alternativeUrls || []
          if (alternatives.length > 0) {
            console.log('🔄 Trying alternative URL:', alternatives[0])
            window.location.href = alternatives[0]
          } else {
            throw new Error('All Persona URLs failed to connect')
          }
        }
      } else {
        console.warn('⚠️ Persona sessionToken provided but URL was missing.', {
          sessionToken: data.sessionToken,
          inquiryId: data.inquiryId,
          debug: data.debug
        })
        throw new Error('No URL provided by Persona API')
      }
    } catch (error) {
      console.error('💥 usePersonaKYC error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return { openPersonaWidget, loading }
}