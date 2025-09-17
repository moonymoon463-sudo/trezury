import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Clock, DollarSign, Calendar, ExternalLink, AlertCircle } from "lucide-react";
import { useLending } from "@/hooks/useLending";
import { Lock, CHAIN_CONFIGS } from "@/types/lending";
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
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-foreground">
              {LendingService.formatAmount(lock.amount_dec, lock.token)}
            </CardTitle>
            <Badge variant="outline" className="border-muted text-muted-foreground">{chainConfig.displayName}</Badge>
          </div>
          <Badge variant={getStatusColor()} className="bg-primary text-primary-foreground">
            {getStatusText()}
          </Badge>
        </div>
        <CardDescription className="text-muted-foreground">
          APY: {LendingService.formatAPY(lock.apy_applied)} • 
          Started {startDate.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {lock.status === 'active' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {isMatured ? 'Ready to claim' : `${daysRemaining} days remaining`}
                </span>
                <span className="text-muted-foreground">{endDate.toLocaleDateString()}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Accrued Interest</p>
                <p className="font-medium text-foreground">
                  {LendingService.formatAmount(lock.accrued_interest_dec, lock.token)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Return</p>
                <p className="font-medium text-foreground">
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

// Pool stats removed - sensitive financial data no longer accessible from frontend

export function LendingProfile() {
  const { user } = useAuth();
  const { locks, claimLock, exitEarly, loading } = useLending();

  if (!user) {
    return (
      <Card className="bg-card border-border">
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Lending Profile</h2>
        <p className="text-muted-foreground">
          Manage your active locks and view historical performance
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="bg-card border-0">
          <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">
            Active Locks ({activeLocks.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">
            History ({completedLocks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeLocks.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2 text-foreground">No Active Locks</h3>
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
            <Card className="bg-card border-border">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2 text-foreground">No History</h3>
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

        {/* Pool stats tab removed - sensitive financial data no longer accessible */}
      </Tabs>
    </div>
  );
}