import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, TrendingUp, AlertCircle, CheckCircle, RefreshCw, Wallet, Activity, DollarSign } from "lucide-react";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { Token } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";
import { PRE_DEPLOYED_CONTRACTS } from "@/contracts/config";

export function QuickActions() {
  const { wallet } = useWalletConnection();
  const { 
    poolReserves, 
    userSupplies, 
    userBorrows, 
    userHealthFactor,
    supply, 
    withdraw, 
    borrow, 
    repay, 
    loading,
    refetch,
    refetchPools
  } = useAaveStyleLending();
  const { toast } = useToast();
  
  const [amount, setAmount] = useState("100");
  const [selectedToken, setSelectedToken] = useState<Token>("USDC");

  const handleQuickSupply = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid amount"
      });
      return;
    }
    
    await supply(selectedToken, amountNum);
  };

  const handleQuickBorrow = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        variant: "destructive", 
        title: "Invalid Amount",
        description: "Please enter a valid amount"
      });
      return;
    }
    
    await borrow(selectedToken, amountNum, 'variable');
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchPools()]);
    toast({
      title: "Data Refreshed",
      description: "Updated pool and user data"
    });
  };

  const selectedPool = poolReserves.find(pool => pool.asset === selectedToken);
  const currentSupply = userSupplies.find(supply => supply.asset === selectedToken);
  const currentBorrow = userBorrows.find(borrow => borrow.asset === selectedToken);

  if (!wallet.isConnected) {
    return (
      <Card className="bg-warning/5 border-warning/20">
        <CardContent className="py-12 text-center">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-warning" />
          <h3 className="text-xl font-bold mb-2 text-warning">Connect Your Wallet</h3>
          <p className="text-muted-foreground">
            Connect your MetaMask wallet to access lending and borrowing features
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2 flex items-center justify-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          Quick Actions
        </h2>
        <p className="text-muted-foreground">
          Fast and simple lending operations with one-click access
        </p>
      </div>

      {/* User Health Overview */}
      {userHealthFactor && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Health Factor</p>
                <p className={`text-2xl font-bold ${userHealthFactor.health_factor > 1.5 ? 'text-green-500' : userHealthFactor.health_factor > 1.2 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {userHealthFactor.health_factor.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Available to Borrow</p>
                <p className="text-lg font-semibold text-foreground">
                  ${userHealthFactor.available_borrow_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Action Form */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Instant Actions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Supply or borrow assets instantly with pre-configured settings
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Asset</label>
              <Select value={selectedToken} onValueChange={(value) => setSelectedToken(value as Token)}>
                <SelectTrigger className="bg-surface-elevated">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-overlay">
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="DAI">DAI</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="XAUT">XAUT</SelectItem>
                  <SelectItem value="AURU">AURU</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="bg-surface-elevated"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Supply</label>
              <Button 
                onClick={handleQuickSupply}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {loading ? "..." : `Supply ${selectedToken}`}
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Borrow</label>
              <Button 
                onClick={handleQuickBorrow}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? "..." : `Borrow ${selectedToken}`}
              </Button>
            </div>
          </div>

          {/* Token Info */}
          {selectedPool && (
            <div className="bg-surface-elevated rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Supply APY</p>
                  <p className="font-semibold text-green-500 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {(selectedPool.supply_rate * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Borrow APY</p>
                  <p className="font-semibold text-foreground">
                    {(selectedPool.borrow_rate_variable * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Available</p>
                  <p className="font-semibold text-foreground">
                    ${selectedPool.available_liquidity_dec.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Utilization</p>
                  <p className="font-semibold text-foreground">
                    {(selectedPool.utilization_rate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Your Positions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-elevated rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Your Supply</span>
              </div>
              {currentSupply ? (
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {currentSupply.supplied_amount_dec.toFixed(4)} {selectedToken}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    +{currentSupply.accrued_interest_dec.toFixed(4)} earned
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No supply position</p>
              )}
            </div>

            <div className="bg-surface-elevated rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Your Borrow</span>
              </div>
              {currentBorrow ? (
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {currentBorrow.borrowed_amount_dec.toFixed(4)} {selectedToken}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    +{currentBorrow.accrued_interest_dec.toFixed(4)} interest
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No borrow position</p>
              )}
            </div>
          </div>

          {/* Test Token Faucet */}
          <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-sm text-blue-400 mb-2 font-medium">Need Test Tokens?</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(PRE_DEPLOYED_CONTRACTS.ethereum.faucets[selectedToken], '_blank')}
              className="text-xs border-blue-500/30 hover:bg-blue-500/10"
            >
              Get {selectedToken} from Faucet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Active Markets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm text-success">
                {poolReserves.length} markets available
              </span>
            </div>
            {poolReserves.slice(0, 3).map(reserve => (
              <div key={reserve.id} className="flex justify-between text-xs py-1">
                <span className="text-foreground">{reserve.asset}</span>
                <Badge variant="secondary" className="text-xs">
                  {(reserve.supply_rate * 100).toFixed(2)}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Your Supplies ({userSupplies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userSupplies.length > 0 ? (
              <div className="space-y-1">
                {userSupplies.slice(0, 3).map(supply => (
                  <div key={supply.id} className="flex justify-between text-xs">
                    <span className="text-foreground">{supply.asset}</span>
                    <span className="text-foreground">{supply.supplied_amount_dec.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No supplies yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Your Borrows ({userBorrows.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userBorrows.length > 0 ? (
              <div className="space-y-1">
                {userBorrows.slice(0, 3).map(borrow => (
                  <div key={borrow.id} className="flex justify-between text-xs">
                    <span className="text-foreground">{borrow.asset}</span>
                    <span className="text-foreground">{borrow.borrowed_amount_dec.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No borrows yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh All Data
        </Button>
      </div>
    </div>
  );
}