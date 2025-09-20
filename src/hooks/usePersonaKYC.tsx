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
      const { data, error } = await supabase.functions.invoke('persona-kyc', {
        body: { action: 'create-inquiry' }
      });

      if (error) throw error;

      return data as PersonaKYCResponse;
    } catch (error) {
      console.error('Failed to create Persona inquiry:', error);
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: "Failed to start identity verification. Please try again."
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const openPersonaWidget = async () => {
    try {
      const inquiry = await createInquiry();
      
      if (inquiry.success && inquiry.url) {
        // Open Persona verification in a new tab
        window.open(inquiry.url, '_blank', 'width=500,height=600');
        
        toast({
          title: "Verification Started",
          description: "Please complete the identity verification process in the new window."
        });
      }
    } catch (error) {
      console.error('Failed to open Persona widget:', error);
    }
  };

  return {
    createInquiry,
    openPersonaWidget,
    loading
  };
};