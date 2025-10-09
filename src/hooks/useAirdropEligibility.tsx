import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AirdropEligibility {
  isEligible: boolean;
  holdingDays: number;
  firstAcquisitionDate: Date | null;
  currentBalance: number;
  monthsHeld: number;
  progressPercentage: number;
  daysRemaining: number;
}

const REQUIRED_HOLDING_DAYS = 180; // 6 months

export function useAirdropEligibility() {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<AirdropEligibility>({
    isEligible: false,
    holdingDays: 0,
    firstAcquisitionDate: null,
    currentBalance: 0,
    monthsHeld: 0,
    progressPercentage: 0,
    daysRemaining: REQUIRED_HOLDING_DAYS,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEligibility = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch holding tracker data
      const { data: trackerData, error: trackerError } = await supabase
        .from('trzry_holding_tracker')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (trackerError) throw trackerError;

      if (!trackerData) {
        // No holding record yet - user hasn't acquired TRZRY
        setEligibility({
          isEligible: false,
          holdingDays: 0,
          firstAcquisitionDate: null,
          currentBalance: 0,
          monthsHeld: 0,
          progressPercentage: 0,
          daysRemaining: REQUIRED_HOLDING_DAYS,
        });
        return;
      }

      // Calculate holding period
      const firstDate = new Date(trackerData.first_acquisition_date);
      const now = new Date();
      const diffMs = now.getTime() - firstDate.getTime();
      const holdingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const monthsHeld = Math.floor(holdingDays / 30);
      const progressPercentage = Math.min((holdingDays / REQUIRED_HOLDING_DAYS) * 100, 100);
      const daysRemaining = Math.max(REQUIRED_HOLDING_DAYS - holdingDays, 0);
      const isEligible = holdingDays >= REQUIRED_HOLDING_DAYS;

      setEligibility({
        isEligible,
        holdingDays,
        firstAcquisitionDate: firstDate,
        currentBalance: parseFloat(String(trackerData.current_balance)) || 0,
        monthsHeld,
        progressPercentage,
        daysRemaining,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load eligibility data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility]);

  // Set up real-time subscription for updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('trzry_holding_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trzry_holding_tracker',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchEligibility();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchEligibility]);

  return {
    eligibility,
    loading,
    error,
    refresh: fetchEligibility,
  };
}
