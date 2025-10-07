import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  user_email: string;
  issue_type: string;
  subject: string;
  description: string;
  screenshot_url?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export const useSupportTickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();

    // Set up realtime subscription for ticket updates
    const channel = supabase
      .channel('support-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('Ticket update:', payload);
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const createTicket = async (ticketData: {
    issue_type: string;
    subject: string;
    description: string;
    priority?: string;
    screenshot_url?: string;
  }) => {
    if (!user) {
      toast.error('You must be logged in to submit a ticket');
      return null;
    }

    setSubmitting(true);
    try {
      // Get user email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile?.email) {
        throw new Error('User email not found');
      }

      // Create ticket
      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{
          user_id: user.id,
          user_email: profile.email,
          issue_type: ticketData.issue_type,
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority || 'normal',
          screenshot_url: ticketData.screenshot_url,
          ticket_number: '',
          status: 'open'
        }])
        .select()
        .single();

      if (error) throw error;

      // Send email notification
      try {
        await supabase.functions.invoke('send-support-email', {
          body: {
            ticket_id: data.id,
            type: 'new_ticket'
          }
        });
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // Don't fail the ticket creation if email fails
      }

      toast.success(`Support ticket created: ${data.ticket_number}`);
      fetchTickets();
      return data;
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      toast.error(error.message || 'Failed to create support ticket');
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const uploadScreenshot = async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('support-screenshots')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('support-screenshots')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading screenshot:', error);
      toast.error('Failed to upload screenshot');
      return null;
    }
  };

  return {
    tickets,
    loading,
    submitting,
    createTicket,
    uploadScreenshot,
    refreshTickets: fetchTickets
  };
};
