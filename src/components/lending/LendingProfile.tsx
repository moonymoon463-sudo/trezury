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
    <Card className="bg-[#2C2C2E] border-[#2C2C2E]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-white">
              {LendingService.formatAmount(lock.amount_dec, lock.token)}
            </CardTitle>
            <Badge variant="outline" className="border-gray-600 text-gray-300">{chainConfig.displayName}</Badge>
          </div>
          <Badge variant={getStatusColor()} className="bg-[#f9b006] text-black">
            {getStatusText()}
          </Badge>
        </div>
        <CardDescription className="text-gray-400">
          APY: {LendingService.formatAPY(lock.apy_applied)} • 
          Started {startDate.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {lock.status === 'active' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-gray-300">
                  <Clock className="h-4 w-4" />
                  {isMatured ? 'Ready to claim' : `${daysRemaining} days remaining`}
                </span>
                <span className="text-gray-300">{endDate.toLocaleDateString()}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Accrued Interest</p>
                <p className="font-medium text-white">
                  {LendingService.formatAmount(lock.accrued_interest_dec, lock.token)}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Total Return</p>
                <p className="font-medium text-white">
                  {LendingService.formatAmount(lock.amount_dec + lock.accrued_interest_dec, lock.token)}
                </p>
              </div>
            </div>
          </>
        )}

        {lock.status === 'exited_early' && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <AlertCircle className="h-4 w-4" />
            <span>Interest forfeited due to early exit</span>
          </div>
        )}

        <div className="flex gap-2">
          {lock.status === 'active' && isMatured && (
            <Button onClick={() => onClaim(lock.id)} className="flex-1 bg-[#f9b006] text-black hover:bg-[#f9b006]/90">
              <DollarSign className="h-4 w-4 mr-1" />
              Claim
            </Button>
          )}
          
          {lock.status === 'active' && !isMatured && (
            <Button 
              variant="outline" 
              onClick={() => onExitEarly(lock.id)}
              className="flex-1 bg-[#2C2C2E] border-[#2C2C2E] text-white hover:bg-[#2C2C2E]/80"
            >
              Exit Early
            </Button>
          )}

          {explorerUrl && (
            <Button variant="outline" size="sm" asChild className="bg-[#2C2C2E] border-[#2C2C2E] text-white hover:bg-[#2C2C2E]/80">
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
    <Card className="bg-[#2C2C2E] border-[#2C2C2E]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="h-5 w-5 text-[#f9b006]" />
          Pool Statistics
        </CardTitle>
        <CardDescription className="text-gray-400">
          Real-time lending pool data across all chains
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-4">
          {stats.map((pool) => {
            const chainConfig = CHAIN_CONFIGS[pool.chain];
            return (
              <div key={`${pool.chain}-${pool.token}`} className="bg-[#1A1A1A] border border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{pool.token}</span>
                    <Badge variant="outline" className="border-gray-600 text-gray-300">{chainConfig.displayName}</Badge>
                  </div>
                  <span className="text-sm text-gray-400">
                    {(pool.utilization_fp * 100).toFixed(1)}% utilized
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">TVL</p>
                    <p className="font-medium text-white">
                      {LendingService.formatAmount(pool.total_deposits_dec, pool.token)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Borrowed</p>
                    <p className="font-medium text-white">
                      {LendingService.formatAmount(pool.total_borrowed_dec, pool.token)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Reserves</p>
                    <p className="font-medium text-white">
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
      <Card className="bg-[#2C2C2E] border-[#2C2C2E]">
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-gray-400">Please sign in to view your lending profile</p>
        </CardContent>
      </Card>
    );
  }

  const activeLocks = locks.filter(lock => lock.status === 'active');
  const completedLocks = locks.filter(lock => lock.status !== 'active');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Lending Profile</h2>
        <p className="text-gray-400">
          Manage your active locks and view historical performance
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="bg-[#2C2C2E] border-0">
          <TabsTrigger value="active" className="data-[state=active]:bg-[#f9b006] data-[state=active]:text-black text-gray-400">
            Active Locks ({activeLocks.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[#f9b006] data-[state=active]:text-black text-gray-400">
            History ({completedLocks.length})
          </TabsTrigger>
          <TabsTrigger value="pools" className="data-[state=active]:bg-[#f9b006] data-[state=active]:text-black text-gray-400">
            Pool Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeLocks.length === 0 ? (
            <Card className="bg-[#2C2C2E] border-[#2C2C2E]">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2 text-white">No Active Locks</h3>
                  <p className="text-gray-400">
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
            <Card className="bg-[#2C2C2E] border-[#2C2C2E]">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2 text-white">No History</h3>
                  <p className="text-gray-400">
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