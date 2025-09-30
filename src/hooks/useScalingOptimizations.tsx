import { useEffect, useCallback } from 'react';
import { cachingService } from '@/services/cachingService';
import { rateLimitingService } from '@/services/rateLimitingService';
import { performanceMonitoringService } from '@/services/performanceMonitoringService';
import { useAuth } from '@/hooks/useAuth';

export const useScalingOptimizations = () => {
  const { user } = useAuth();

  const startTiming = useCallback((label: string) => {
    performanceMonitoringService.mark(`${label}-start`);
  }, []);

  const endTiming = useCallback((label: string) => {
    const endMark = `${label}-end`;
    performanceMonitoringService.mark(endMark);
    performanceMonitoringService.measure(label, `${label}-start`, endMark);
  }, []);

  const fetchWithOptimizations = useCallback(async (
    cacheKey: string,
    fetcher: () => Promise<any>,
    options: {
      ttl?: number;
      rateLimitEndpoint?: string;
      rateLimitCost?: number;
    } = {}
  ): Promise<any> => {
    const { ttl = 300000, rateLimitEndpoint, rateLimitCost = 1 } = options;

    if (user && rateLimitEndpoint) {
      const rateLimitResult = await rateLimitingService.checkApiLimit(
        user.id,
        rateLimitEndpoint,
        rateLimitCost
      );

      if (!rateLimitResult.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`);
      }
    }

    const startTime = Date.now();
    
    try {
      const result = await cachingService.get(cacheKey, fetcher, ttl);
      
      performanceMonitoringService.recordResponseTime(
        rateLimitEndpoint || cacheKey,
        Date.now() - startTime
      );

      if (user) {
        performanceMonitoringService.recordUserAction('api_call', user.id);
      }

      return result;
    } catch (error) {
      performanceMonitoringService.recordMetric('api_error', 1, 'count', {
        endpoint: rateLimitEndpoint || cacheKey,
        error: (error as Error).message
      });
      throw error;
    }
  }, [user]);

  const fetchGoldPrices = useCallback(async () => {
    return fetchWithOptimizations(
      'gold-prices-latest',
      async () => {
        const response = await fetch('https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-api');
        if (!response.ok) throw new Error('Failed to fetch gold prices');
        return response.json();
      },
      {
        ttl: 120000, // Increased to 2 minutes
        rateLimitEndpoint: 'gold-prices',
        rateLimitCost: 1
      }
    );
  }, [fetchWithOptimizations]);

  useEffect(() => {
    if (user) {
      performanceMonitoringService.recordUserAction('session_start', user.id);
      return () => {
        performanceMonitoringService.recordUserAction('session_end', user.id);
      };
    }
  }, [user]);

  return {
    fetchGoldPrices,
    startTiming,
    endTiming,
    invalidateCache: (pattern: string) => cachingService.invalidatePattern(pattern),
    fetchWithOptimizations
  };
};