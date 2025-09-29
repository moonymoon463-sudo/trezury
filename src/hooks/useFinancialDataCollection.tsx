import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFinancialDataCollection = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const triggerNewsCollection = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('financial-news-collector', {
        body: { manual_trigger: true }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Financial news collection triggered successfully",
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger news collection';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const checkNewsStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('financial_news')
        .select('count')
        .limit(1);

      if (error) throw error;
      
      return data?.length || 0;
    } catch (err) {
      console.error('Failed to check news status:', err);
      return 0;
    }
  }, []);

  const getLatestNews = useCallback(async (limit: number = 10) => {
    try {
      const { data, error } = await supabase
        .from('financial_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to fetch latest news:', err);
      return [];
    }
  }, []);

  return {
    loading,
    error,
    triggerNewsCollection,
    checkNewsStatus,
    getLatestNews
  };
};