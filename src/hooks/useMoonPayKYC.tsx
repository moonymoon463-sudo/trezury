import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export function useMoonPayKYC() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const openMoonPayKYC = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No session')

      console.log('🚀 Starting MoonPay KYC flow...')
      console.log('🔧 Client-side debug info:', {
        hasSession: !!session?.access_token,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.slice(0, 50) + '...'
      })
      
      const { data, error } = await supabase.functions.invoke('moonpay-kyc', {
        body: { action: 'create-widget-url' },
        headers: { Authorization: `Bearer ${session.access_token}` }
      })

      console.log('📡 MoonPay KYC API response:', { data, error })

      if (error) {
        console.error('❌ MoonPay KYC API error:', error)
        toast({
          variant: "destructive",
          title: "KYC Service Error",
          description: "Unable to start verification. Please try again."
        })
        throw error
      }
      
      if (!data?.widgetUrl) {
        console.error('❌ Missing widget URL in response:', data)
        toast({
          variant: "destructive",
          title: "Configuration Error", 
          description: "KYC widget URL not available. Please contact support."
        })
        throw new Error('No widget URL returned from MoonPay')
      }

      console.log('✅ MoonPay KYC response valid:', {
        hasWidgetUrl: !!data.widgetUrl,
        customerId: data.customerId
      })

      console.log('🔄 Redirecting to MoonPay KYC widget:', data.widgetUrl)
      
      // Open MoonPay widget in same window
      window.location.href = data.widgetUrl
      
    } catch (error) {
      console.error('💥 useMoonPayKYC error:', error)
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('temporarily unavailable')) {
          toast({
            variant: "destructive",
            title: "Service Temporarily Unavailable",
            description: "KYC verification is temporarily unavailable. Please try again later."
          })
        } else if (error.message.includes('profile not found')) {
          toast({
            variant: "destructive", 
            title: "Profile Error",
            description: "Unable to load your profile. Please refresh and try again."
          })
        } else {
          toast({
            variant: "destructive",
            title: "Verification Error",
            description: "Unable to start identity verification. Please try again."
          })
        }
      }
      
      throw error
    } finally {
      setLoading(false)
    }
  }

  return { openMoonPayKYC, loading }
}