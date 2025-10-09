import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface ReferralStats {
  referral_code: string;
  total_points: number;
  pending_points: number;
  total_referrals: number;
  active_referrals: number;
  points_earned: number;
}

interface Referral {
  id: string;
  referee_email: string;
  status: string;
  points_awarded: number;
  created_at: string;
  completed_first_trade_at: string | null;
}

export function useReferralSystem() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchReferralData();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('referral-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'referrals',
          filter: `referrer_id=eq.${user.id}`
        },
        () => {
          fetchReferralData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchReferralData = async () => {
    if (!user) return;

    try {
      // Fetch referral code
      const { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch point balance
      const { data: balanceData, error: balanceError } = await supabase
        .from('referral_point_balances')
        .select('total_points')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch referrals
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      // Get points earned from each referral
      const referralsWithDetails = await Promise.all(
        (referralsData || []).map(async (ref) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', ref.referee_id)
            .single();

          // Get points earned from this referral
          const { data: points } = await supabase
            .from('referral_points')
            .select('points')
            .eq('related_referral_id', ref.id)
            .eq('user_id', user.id);

          const pointsEarned = points?.reduce((sum, p) => sum + p.points, 0) || 0;
          
          return {
            id: ref.id,
            referee_email: profile?.email || 'Unknown',
            status: ref.status,
            points_awarded: pointsEarned,
            created_at: ref.created_at,
            completed_first_trade_at: ref.completed_at
          };
        })
      );

      // Calculate stats
      const totalReferrals = referralsData?.length || 0;
      const activeReferrals = referralsData?.filter(r => r.status === 'completed').length || 0;
      const pendingReferrals = referralsData?.filter(r => r.status === 'pending').length || 0;
      const totalPoints = balanceData?.total_points || 0;
      const pointsEarned = referralsWithDetails.reduce((sum, r) => sum + r.points_awarded, 0);

      setStats({
        referral_code: codeData?.code || '',
        total_points: totalPoints,
        pending_points: pendingReferrals * 2, // 2 points per pending referral
        total_referrals: totalReferrals,
        active_referrals: activeReferrals,
        points_earned: pointsEarned
      });

      setReferrals(referralsWithDetails);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    if (!stats?.referral_code) return;
    
    navigator.clipboard.writeText(stats.referral_code);
    toast({
      title: "Copied!",
      description: "Referral code copied to clipboard",
    });
  };

  const shareReferralLink = async () => {
    if (!stats?.referral_code) return;

    const shareUrl = `https://trezury.app/auth?ref=${stats.referral_code}`;
    const shareText = `Join Trezury and get 2 bonus points! Use my referral code: ${stats.referral_code}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Trezury',
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled share or error occurred
        navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied!",
          description: "Referral link copied to clipboard",
        });
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied!",
        description: "Referral link copied to clipboard",
      });
    }
  };

  return {
    stats,
    referrals,
    loading,
    copyReferralCode,
    shareReferralLink,
    refresh: fetchReferralData
  };
}
