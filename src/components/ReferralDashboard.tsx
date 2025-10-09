import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Share2, Gift, TrendingUp, Users, CheckCircle2, Clock } from 'lucide-react';
import { useReferralSystem } from '@/hooks/useReferralSystem';
import { Skeleton } from '@/components/ui/skeleton';

export function ReferralDashboard() {
  const { stats, referrals, loading, copyReferralCode, shareReferralLink } = useReferralSystem();

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const conversionRate = stats.total_referrals > 0 
    ? ((stats.active_referrals / stats.total_referrals) * 100).toFixed(1)
    : '0';

  return (
    <Card className="bg-card/50 backdrop-blur border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          Earn Referral Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Code Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Your Referral Code</p>
            <Badge variant="outline" className="font-mono">
              {stats.referral_code}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={copyReferralCode}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={shareReferralLink}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Link
            </Button>
          </div>
        </div>

        {/* Points Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground">Total Points</p>
            <p className="text-2xl font-bold text-primary">{stats.total_points}</p>
          </div>
          <div className="space-y-1 p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{stats.pending_points}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1 text-center p-3 rounded-lg bg-muted/30">
            <Users className="w-4 h-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold">{stats.total_referrals}</p>
            <p className="text-xs text-muted-foreground">Referrals</p>
          </div>
          <div className="space-y-1 text-center p-3 rounded-lg bg-muted/30">
            <CheckCircle2 className="w-4 h-4 mx-auto text-green-500" />
            <p className="text-lg font-bold">{stats.active_referrals}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="space-y-1 text-center p-3 rounded-lg bg-muted/30">
            <TrendingUp className="w-4 h-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Rate</p>
          </div>
        </div>

        {/* How It Works */}
        <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border">
          <p className="text-sm font-semibold">How to Earn Points:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              Share your referral code with friends
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              Both you and your friend get 2 points when they sign up
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              Earn 1 additional point when they complete their first trade
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">4.</span>
              Use points to qualify for monthly airdrops
            </li>
          </ul>
        </div>

        {/* Airdrop Eligibility & Rewards */}
        <div className="space-y-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm font-semibold text-primary">Airdrop Eligibility & Rewards</p>
          
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Eligibility:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>All users who participate in the referral program are eligible for the airdrop</li>
                <li>Users with accumulated points will receive a larger share compared to those without points</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">Airdrop Timing:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>The airdrop will be distributed at the end of the airdrop period</li>
                <li>The airdrop period is defined on a monthly, quarterly, or suitable timeframe</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">Holding Requirement:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Participants must hold the token for the entire duration of the airdrop period to be eligible</li>
                <li>Users who do not maintain their holdings until the end may receive a reduced airdrop or become ineligible</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">Reward Calculation:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>All eligible users will receive a base amount of tokens</li>
                <li>Users with accumulated points will receive additional tokens proportional to their points</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">Transparency and Tracking:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Users can view their referral history, points, and airdrop status via this dashboard</li>
                <li>The entire airdrop process is transparent, ensuring you can track your rewards easily</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Recent Referrals */}
        {referrals.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Your Referrals</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {referrals.slice(0, 5).map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ref.referee_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={ref.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {ref.status === 'completed' ? (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 mr-1" />
                      )}
                      {ref.status === 'completed' ? 'Active' : 'Pending'}
                    </Badge>
                    <span className="text-sm font-semibold">+{ref.points_awarded}</span>
                  </div>
                </div>
              ))}
            </div>
            {referrals.length > 5 && (
              <p className="text-xs text-center text-muted-foreground">
                Showing 5 of {referrals.length} referrals
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
