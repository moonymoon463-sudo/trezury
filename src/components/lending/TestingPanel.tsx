import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestTube, Database, TrendingUp, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { Token } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";
import { PRE_DEPLOYED_CONTRACTS } from "@/contracts/config";

export function TestingPanel() {
  const { wallet } = useWalletConnection();
  const { 
    poolReserves, 
    userSupplies, 
    userBorrows, 
    supply, 
    withdraw, 
    borrow, 
    repay, 
    loading,
    refetch,
    refetchPools
  } = useAaveStyleLending();
  const { toast } = useToast();
  
  const [testAmount, setTestAmount] = useState("100");
  const [selectedToken, setSelectedToken] = useState<Token>("USDC");

  const handleTestSupply = async () => {
    const amount = parseFloat(testAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid amount"
      });
      return;
    }
    
    await supply(selectedToken, amount);
  };

  const handleTestWithdraw = async () => {
    const amount = parseFloat(testAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    await withdraw(selectedToken, amount);
  };

  const handleTestBorrow = async () => {
    const amount = parseFloat(testAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    await borrow(selectedToken, amount, 'variable');
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchPools()]);
    toast({
      title: "Data Refreshed",
      description: "Updated pool and user data from database"
    });
  };

  const getContractAddress = (token: Token) => {
    return PRE_DEPLOYED_CONTRACTS.ethereum.tokens[token];
  };

  const getFaucetUrl = (token: Token) => {
    return PRE_DEPLOYED_CONTRACTS.ethereum.faucets[token];
  };

  if (!wallet.isConnected) {
    return (
      <Card className="bg-warning/10 border-warning/20">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-warning" />
          <h3 className="text-lg font-medium mb-2 text-warning">Wallet Required</h3>
          <p className="text-muted-foreground">
            Connect your wallet to test lending functionality
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-primary" />
            Lending Testing Panel
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test lending operations with pre-deployed contracts and database integration
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Token</label>
              <Select value={selectedToken} onValueChange={(value) => setSelectedToken(value as Token)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Actions</label>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleTestSupply}
                  disabled={loading}
                  className="flex-1"
                >
                  Supply
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleTestBorrow}
                  disabled={loading}
                  className="flex-1"
                >
                  Borrow
                </Button>
              </div>
            </div>
          </div>

          {/* Contract Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-surface-elevated">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Contract Address</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-surface px-2 py-1 rounded font-mono">
                  {getContractAddress(selectedToken).substring(0, 10)}...
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`https://sepolia.etherscan.io/address/${getContractAddress(selectedToken)}`, '_blank')}
                  className="h-6 px-2 text-xs"
                >
                  View
                </Button>
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-surface-elevated">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Get Test Tokens</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(getFaucetUrl(selectedToken), '_blank')}
                className="w-full"
              >
                Open {selectedToken} Faucet
              </Button>
            </div>
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
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Pool Reserves
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {poolReserves.length > 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">
                    {poolReserves.length} markets loaded
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <span className="text-sm text-warning">No markets found</span>
                </>
              )}
            </div>
            {poolReserves.slice(0, 3).map(reserve => (
              <div key={reserve.id} className="flex justify-between text-xs mt-1">
                <span>{reserve.asset}</span>
                <Badge variant="secondary">{(reserve.supply_rate * 100).toFixed(2)}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Your Supplies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {userSupplies.length > 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">
                    {userSupplies.length} positions
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">No supplies yet</span>
                </>
              )}
            </div>
            {userSupplies.slice(0, 3).map(supply => (
              <div key={supply.id} className="flex justify-between text-xs mt-1">
                <span>{supply.asset}</span>
                <span>{supply.supplied_amount_dec.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Your Borrows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {userBorrows.length > 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">
                    {userBorrows.length} positions
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">No borrows yet</span>
                </>
              )}
            </div>
            {userBorrows.slice(0, 3).map(borrow => (
              <div key={borrow.id} className="flex justify-between text-xs mt-1">
                <span>{borrow.asset}</span>
                <span>{borrow.borrowed_amount_dec.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}