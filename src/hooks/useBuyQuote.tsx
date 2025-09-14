import { useState, useEffect, useCallback } from 'react';
import { quoteEngineService, QuoteRequest, Quote } from '@/services/quoteEngine';
import { useAuth } from './useAuth';

export const useBuyQuote = () => {
  const { user } = useAuth();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuote = useCallback(async (request: QuoteRequest) => {
    if (!user) {
      setError('User must be authenticated to generate quotes');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const newQuote = await quoteEngineService.generateQuote(request, user.id);
      setQuote(newQuote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quote');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const clearQuote = useCallback(() => {
    setQuote(null);
    setError(null);
  }, []);

  // Check if quote is expired
  const isQuoteExpired = useCallback(() => {
    if (!quote) return true;
    return new Date() > new Date(quote.expiresAt);
  }, [quote]);

  return {
    quote,
    loading,
    error,
    generateQuote,
    clearQuote,
    isQuoteExpired
  };
};