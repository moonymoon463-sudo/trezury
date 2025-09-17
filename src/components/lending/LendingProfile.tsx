import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Clock, TrendingUp, DollarSign, Calendar, ExternalLink, AlertCircle } from "lucide-react";
import { useLending } from "@/hooks/useLending";
import { Lock, PoolStats, CHAIN_CONFIGS } from "@/types/lending";
import { LendingService } from "@/services/lendingService";
import { useAuth } from "@/hooks/useAuth";

function LockCard({ lock, onClaim, onExitEarly }: { 
  lock: Lock; 
  onClaim: (id: string) => void;
  onExitEarly: (id: string) => void;
}) {
  const now = new Date();
  const startDate = new Date(lock.start_ts);
  const endDate = new Date(lock.end_ts);
  const isMatured = now >= endDate;
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const progressPercent = Math.min(100, ((now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100);
  
  const chainConfig = CHAIN_CONFIGS[lock.chain];
  const explorerUrl = lock.deposit_tx ? `${chainConfig.explorerUrl}/tx/${lock.deposit_tx}` : null;

  const getStatusColor = () => {
    switch (lock.status) {
      case 'active': return isMatured ? 'default' : 'secondary';
      case 'matured': return 'default';
      case 'exited_early': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusText = () => {
    if (lock.status === 'exited_early') return 'Exited Early';
    if (lock.status === 'matured') return 'Matured';
    return isMatured ? 'Ready to Claim' : 'Active';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">
              {LendingService.formatAmount(lock.amount_dec, lock.token)}
            </CardTitle>
            <Badge variant="outline">{chainConfig.displayName}</Badge>
          </div>
          <Badge variant={getStatusColor()}>
            {getStatusText()}
          </Badge>
        </div>
        <CardDescription>
          APY: {LendingService.formatAPY(lock.apy_applied)} • 
          Started {startDate.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {lock.status === 'active' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {isMatured ? 'Ready to claim' : `${daysRemaining} days remaining`}
                </span>
                <span>{endDate.toLocaleDateString()}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Accrued Interest</p>
                <p className="font-medium">
                  {LendingService.formatAmount(lock.accrued_interest_dec, lock.token)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Return</p>
                <p className="font-medium">
                  {LendingService.formatAmount(lock.amount_dec + lock.accrued_interest_dec, lock.token)}
                </p>
              </div>
            </div>
          </>
        )}

        {lock.status === 'exited_early' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Interest forfeited due to early exit</span>
          </div>
        )}

        <div className="flex gap-2">
          {lock.status === 'active' && isMatured && (
            <Button onClick={() => onClaim(lock.id)} className="flex-1">
              <DollarSign className="h-4 w-4 mr-1" />
              Claim
            </Button>
          )}
          
          {lock.status === 'active' && !isMatured && (
            <Button 
              variant="outline" 
              onClick={() => onExitEarly(lock.id)}
              className="flex-1"
            >
              Exit Early
            </Button>
          )}

          {explorerUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PoolStatsCard({ stats }: { stats: PoolStats[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Pool Statistics
        </CardTitle>
        <CardDescription>
          Real-time lending pool data across all chains
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-4">
          {stats.map((pool) => {
            const chainConfig = CHAIN_CONFIGS[pool.chain];
            return (
              <div key={`${pool.chain}-${pool.token}`} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pool.token}</span>
                    <Badge variant="outline">{chainConfig.displayName}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {(pool.utilization_fp * 100).toFixed(1)}% utilized
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">TVL</p>
                    <p className="font-medium">
                      {LendingService.formatAmount(pool.total_deposits_dec, pool.token)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Borrowed</p>
                    <p className="font-medium">
                      {LendingService.formatAmount(pool.total_borrowed_dec, pool.token)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reserves</p>
                    <p className="font-medium">
                      {LendingService.formatAmount(pool.reserve_balance_dec, pool.token)}
                    </p>
                  </div>
                </div>
                
                <Progress value={pool.utilization_fp * 100} className="mt-3 h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function LendingProfile() {
  const { user } = useAuth();
  const { locks, poolStats, claimLock, exitEarly, loading } = useLending();

  if (!user) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Please sign in to view your lending profile</p>
        </CardContent>
      </Card>
    );
  }

  const activeLocks = locks.filter(lock => lock.status === 'active');
  const completedLocks = locks.filter(lock => lock.status !== 'active');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Lending Profile</h2>
        <p className="text-muted-foreground">
          Manage your active locks and view historical performance
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active">
            Active Locks ({activeLocks.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History ({completedLocks.length})
          </TabsTrigger>
          <TabsTrigger value="pools">
            Pool Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeLocks.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Active Locks</h3>
                  <p className="text-muted-foreground">
                    Create your first lock to start earning yield
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeLocks.map((lock) => (
                <LockCard
                  key={lock.id}
                  lock={lock}
                  onClaim={claimLock}
                  onExitEarly={exitEarly}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {completedLocks.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No History</h3>
                  <p className="text-muted-foreground">
                    Completed locks will appear here
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {completedLocks.map((lock) => (
                <LockCard
                  key={lock.id}
                  lock={lock}
                  onClaim={claimLock}
                  onExitEarly={exitEarly}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pools">
          <PoolStatsCard stats={poolStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}