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

      // Prefer URL; fallback to token flow
      if (data.url) {
        console.log('🔄 Redirecting to Persona URL:', data.url)
        window.location.href = data.url
      } else {
        console.warn('⚠️ Persona sessionToken provided but URL was missing.', {
          sessionToken: data.sessionToken,
          inquiryId: data.inquiryId
        })
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