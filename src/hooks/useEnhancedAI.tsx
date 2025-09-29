import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  summary?: string;
  source: string;
  category: string;
  published_at: string;
  tags: string[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: {
    name: string;
  };
}

export interface EducationalContent {
  id: string;
  title: string;
  content: string;
  difficulty_level: string;
  category: string;
  tags: string[];
  reading_time_minutes?: number;
}

export const useEnhancedAI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch recent financial news
  const getRecentNews = useCallback(async (category?: string, limit: number = 10): Promise<NewsItem[]> => {
    try {
      setLoading(true);
      let query = supabase
        .from('financial_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Search FAQ items
  const searchFAQ = useCallback(async (query: string): Promise<FAQItem[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('faq_items')
        .select(`
          id,
          question,
          answer,
          keywords,
          faq_categories!inner(name)
        `)
        .eq('is_active', true)
        .or(`question.ilike.%${query}%,answer.ilike.%${query}%,keywords.cs.{${query}}`);

      if (error) throw error;
      return data?.map(item => ({
        ...item,
        category: { name: item.faq_categories.name }
      })) || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search FAQ');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get educational content by category or difficulty
  const getEducationalContent = useCallback(async (
    category?: string, 
    difficulty?: string, 
    limit: number = 10
  ): Promise<EducationalContent[]> => {
    try {
      setLoading(true);
      let query = supabase
        .from('educational_content')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }
      
      if (difficulty) {
        query = query.eq('difficulty_level', difficulty);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch educational content');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get FAQ categories
  const getFAQCategories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('faq_categories')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch FAQ categories');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger news collection
  const collectFinancialNews = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('financial-news-collector');
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collect news');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getRecentNews,
    searchFAQ,
    getEducationalContent,
    getFAQCategories,
    collectFinancialNews
  };
};