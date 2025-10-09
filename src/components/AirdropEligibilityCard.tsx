import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Gift, Calendar, TrendingUp, CheckCircle2, Users } from "lucide-react";
import { useAirdropEligibility } from "@/hooks/useAirdropEligibility";
import { useReferralSystem } from "@/hooks/useReferralSystem";

export function AirdropEligibilityCard() {
  const { eligibility, loading } = useAirdropEligibility();
  const { stats: referralStats } = useReferralSystem();

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
        <div className="h-20 bg-muted rounded"></div>
      </Card>
    );
  }

  const { 
    isEligible, 
    holdingDays, 
    monthsHeld, 
    progressPercentage, 
    daysRemaining,
    firstAcquisitionDate 
  } = eligibility;

  return (
    <Card className={`p-4 ${isEligible ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30' : 'bg-muted/30'}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isEligible ? 'bg-green-500/20' : 'bg-primary/20'
        }`}>
          {isEligible ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Gift className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm">Airdrop Eligibility</h3>
            {isEligible && (
              <Badge variant="default" className="bg-green-500 text-white text-xs">
                Qualified! 🎉
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isEligible 
              ? "You're eligible for the next airdrop! Keep holding to maintain eligibility."
              : "Hold your TRZRY for 6 months to qualify for the next airdrop!"}
          </p>
        </div>
      </div>

      {/* Progress Section */}
      {!isEligible && firstAcquisitionDate && (
        <div className="space-y-3 mt-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Holding Progress</span>
              <span className="font-semibold text-foreground">
                {monthsHeld} / 6 months
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{holdingDays} days</span>
              <span>{daysRemaining} days remaining</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="font-medium text-foreground">
                  {firstAcquisitionDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <div>
                <p className="text-muted-foreground">Milestone</p>
                <p className="font-medium text-foreground">
                  {Math.round(progressPercentage)}% Complete
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Holdings Message */}
      {!firstAcquisitionDate && (
        <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
          <p className="text-xs text-center text-muted-foreground">
            💡 Buy TRZRY now to start your 6-month airdrop countdown!
          </p>
        </div>
      )}

      {/* Qualified Success State */}
      {isEligible && (
        <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <p className="text-xs text-center text-green-700 dark:text-green-400 font-medium">
            🎁 You've held TRZRY for {monthsHeld}+ months and qualify for airdrops!
          </p>
        </div>
      )}

      {/* Referral Points Section */}
      {referralStats && referralStats.total_points > 0 && (
        <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <p className="text-xs font-medium">Referral Bonus</p>
            </div>
            <Badge variant="secondary" className="font-semibold">
              +{referralStats.total_points} pts
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Referral points boost your airdrop eligibility each month
          </p>
        </div>
      )}
    </Card>
  );
}
