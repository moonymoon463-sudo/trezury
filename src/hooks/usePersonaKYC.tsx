import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PersonaKYCResponse {
  success: boolean;
  inquiryId?: string;
  sessionToken?: string;
  url?: string;
  error?: string;
}

export const usePersonaKYC = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const createInquiry = async (): Promise<PersonaKYCResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    try {
      // Ensure we have the session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('persona-kyc', {
        body: { action: 'create-inquiry' },
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`
        }
      });

      if (error) throw error;

      return data as PersonaKYCResponse;
    } catch (error: any) {
      console.error('Failed to create Persona inquiry:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      
      // Show more specific error message if available
      const errorMessage = error?.message || error?.details || "Failed to start identity verification. Please try again.";
      
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: errorMessage
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const openPersonaWidget = async () => {
    try {
      const inquiry = await createInquiry();
      
      if (inquiry.success) {
        const redirectUrl = inquiry.url || (inquiry.inquiryId && inquiry.sessionToken
          ? `https://withpersona.com/verify?inquiry-id=${inquiry.inquiryId}&inquiry-session-token=${inquiry.sessionToken}`
          : undefined);

        if (redirectUrl) {
          // Redirect to Persona verification (avoids popup blockers)
          window.location.href = redirectUrl;

          toast({
            title: "Verification Started",
            description: "Redirecting to identity verification..."
          });
        } else {
          toast({
            variant: "destructive",
            title: "Verification Error",
            description: "Missing redirect URL from KYC provider. Please try again."
          });
        }
      }
    } catch (error) {
      console.error('Failed to open Persona widget:', error);
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: "Could not start verification. Please try again."
      });
    }
  };

  return {
    createInquiry,
    openPersonaWidget,
    loading
  };
};