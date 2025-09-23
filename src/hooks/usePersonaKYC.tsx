import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function usePersonaKYC() {
  const [loading, setLoading] = useState(false)

  const openPersonaWidget = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No session')

      const { data, error } = await supabase.functions.invoke('persona-kyc', {
        body: { action: 'create-inquiry' },
        headers: { Authorization: `Bearer ${session.access_token}` }
      })

      if (error) throw error
      if (!data?.url && !data?.sessionToken) {
        throw new Error('No URL or session token returned from Persona')
      }

      // Prefer URL; fallback to token flow
      if (data.url) {
        window.location.href = data.url
      } else {
        // If you use Persona JS SDK, initialize with sessionToken here.
        // e.g., Persona.launch({ inquiryId, sessionToken })
        console.warn('Persona sessionToken provided but URL was missing.')
      }
    } finally {
      setLoading(false)
    }
  }

  return { openPersonaWidget, loading }
}