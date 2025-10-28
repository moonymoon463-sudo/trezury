import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSnxMarkets } from '@/hooks/useSnxMarkets';
import { useSnxTrading } from '@/hooks/useSnxTrading';
import { useSnxPositions } from '@/hooks/useSnxPositions';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, RefreshCw, Copy, Check, Shield, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';
import TradingViewChart from '@/components/trading/TradingViewChart';
import SecureWalletSetup from '@/components/SecureWalletSetup';
import { SnxAccountSetup } from '@/components/trading/SnxAccountSetup';
import { NetworkSwitcher } from '@/components/trading/NetworkSwitcher';
import { PasswordUnlockDialog } from '@/components/trading/PasswordUnlockDialog';
import { OrderHistory } from '@/components/trading/OrderHistory';
import { OpenPositionsTable } from '@/components/trading/OpenPositionsTable';
import { tradeAuditService } from '@/services/tradeAuditService';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';

const TradingDashboard = () => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showInternalWalletSetup, setShowInternalWalletSetup] = useState(false);
  const [showSnxAccountSetup, setShowSnxAccountSetup] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string>('ETH');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [leverage, setLeverage] = useState(1);
  const [orderSize, setOrderSize] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [chainId, setChainId] = useState(8453); // Base by default
  const [walletSource, setWalletSource] = useState<'internal' | 'external'>('internal');
  const [snxAccountId, setSnxAccountId] = useState<bigint | null>(null);
  const [copied, setCopied] = useState(false);
  
  const { user, loading: authLoading } = useAuth();
  const { getPassword } = useTradingPasswordContext();
  const { toast } = useToast();
  
  // External wallet (MetaMask)
  const { wallet, connectWallet } = useWalletConnection();
  
  // Internal wallet
  const { balances, totalValue, loading: internalLoading, isConnected: internalConnected, walletAddress: internalAddress, refreshBalances } = useWalletBalance();
  
  // Synthetix markets and trading
  const { markets, loading: marketsLoading } = useSnxMarkets(chainId);
  const { accountInfo, placeOrder, orderLoading, loadAccountInfo } = useSnxTrading(chainId);
  const { positions, loading: positionsLoading, refreshPositions } = useSnxPositions(snxAccountId || undefined, chainId);
  
  // Show loading state while auth initializes
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Trading Dashboard...</p>
        </div>
      </div>
    );
  }

  // Fetch Synthetix account ID from database on mount
  useEffect(() => {
    const fetchSnxAccount = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('snx_accounts')
        .select('account_id')
        .eq('user_id', user.id)
        .eq('chain_id', chainId)
        .maybeSingle();
      
      if (data) {
        setSnxAccountId(BigInt(data.account_id));
      }
    };
    
    fetchSnxAccount();
  }, [user, chainId]);

  // Load Synthetix account info when account ID is available
  useEffect(() => {
    if (user && snxAccountId) {
      loadAccountInfo(snxAccountId);
    }
  }, [user, snxAccountId]);

  // Show account setup if user doesn't have Synthetix account
  useEffect(() => {
    if (user && !snxAccountId && internalConnected) {
      setShowSnxAccountSetup(true);
    }
  }, [user, snxAccountId, internalConnected]);

  const currentMarket = markets.find(m => m.marketKey === selectedMarket);
  const currentWalletAddress = walletSource === 'internal' ? internalAddress : wallet.address;
  const currentWalletBalance = accountInfo?.collateral || totalValue || 0;
  const availableMargin = accountInfo?.availableMargin || 0;
  const isCurrentWalletConnected = walletSource === 'internal' ? internalConnected : wallet.isConnected;

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      setShowWalletModal(false);
      toast({
        title: "Wallet Connected",
        description: `Connected to ${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}`,
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleRefreshBalances = async () => {
    await refreshBalances();
    if (snxAccountId) {
      await loadAccountInfo(snxAccountId);
    }
    await refreshPositions();
    toast({
      title: "Balances Updated",
      description: "Your wallet balances have been refreshed.",
    });
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Address Copied",
      description: "Wallet address copied to clipboard",
    });
  };

  const handleInternalWalletCreated = async (address: string) => {
    setShowInternalWalletSetup(false);
    await refreshBalances();
    toast({
      title: "Internal Wallet Ready",
      description: "Your secure wallet has been set up successfully!",
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedMarket || !orderSize) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please enter order size'
      });
      return;
    }

    if (!snxAccountId) {
      toast({
        variant: 'destructive',
        title: 'No Trading Account',
        description: 'Please create a Synthetix trading account first'
      });
      return;
    }

    if (!isCurrentWalletConnected) {
      toast({
        variant: 'destructive',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first'
      });
      return;
    }

    setShowPasswordDialog(true);
  };

  const handlePasswordUnlock = async (password: string) => {
    setShowPasswordDialog(false);

    if (!selectedMarket || !snxAccountId) return;

    const currentPrice = currentMarket?.indexPrice || 0;
    const size = parseFloat(orderSize);

    const response = await placeOrder({
      marketKey: selectedMarket,
      side: tradeMode === 'buy' ? 'BUY' : 'SELL',
      type: orderType === 'market' ? 'MARKET' : 'LIMIT',
      size: size,
      leverage,
      price: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
      slippageBps: 50 // 0.5% slippage
    }, walletSource, password);

    // Log to audit trail
    await tradeAuditService.logOrderPlacement(
      selectedMarket,
      orderType,
      tradeMode === 'buy' ? 'BUY' : 'SELL',
      size,
      currentPrice,
      leverage,
      response.success,
      response.error
    );

    if (response.success) {
      setOrderSize('');
      setLimitPrice('');
      
      if (snxAccountId) {
        loadAccountInfo(snxAccountId);
      }
      
      toast({
        title: 'Order Placed',
        description: `${tradeMode === 'buy' ? 'Buy' : 'Sell'} order placed successfully!`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: response.error || 'Failed to place order'
      });
    }
  };

  const handleAccountCreated = async (accountId: bigint) => {
    setSnxAccountId(accountId);
    setShowSnxAccountSetup(false);
    
    // Load account info immediately after creation
    await loadAccountInfo(accountId);
    
    toast({
      title: "Trading Account Created",
      description: "Your Synthetix trading account is ready!",
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Synthetix Perpetuals</h1>
            <p className="text-muted-foreground">Trade with up to 50× leverage on multiple networks</p>
          </div>
          
          <div className="flex items-center gap-3">
            <NetworkSwitcher chainId={chainId} onChainChange={setChainId} />
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshBalances}
              disabled={internalLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${internalLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Wallet Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Wallet & Balance</CardTitle>
              <Tabs value={walletSource} onValueChange={(v) => setWalletSource(v as 'internal' | 'external')}>
                <TabsList>
                  <TabsTrigger value="internal">
                    <Shield className="h-4 w-4 mr-2" />
                    Internal
                  </TabsTrigger>
                  <TabsTrigger value="external">
                    <WalletIcon className="h-4 w-4 mr-2" />
                    External
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {walletSource === 'internal' ? (
              internalConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Wallet Address</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm">{internalAddress?.slice(0, 6)}...{internalAddress?.slice(-4)}</p>
                        <Button variant="ghost" size="sm" onClick={() => internalAddress && copyAddress(internalAddress)}>
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Balance</p>
                      <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
                    </div>
                  </div>
                  {snxAccountId && accountInfo && (
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Collateral</p>
                        <p className="font-semibold">${accountInfo.collateral.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Available Margin</p>
                        <p className="font-semibold">${accountInfo.availableMargin.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total PnL</p>
                        <p className={`font-semibold ${accountInfo.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ${accountInfo.totalPnl.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Button onClick={() => setShowInternalWalletSetup(true)}>
                    <Shield className="h-4 w-4 mr-2" />
                    Setup Internal Wallet
                  </Button>
                </div>
              )
            ) : (
              wallet.isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Wallet Address</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm">{wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}</p>
                        <Button variant="ghost" size="sm" onClick={() => wallet.address && copyAddress(wallet.address)}>
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Button onClick={handleConnectWallet}>
                    <WalletIcon className="h-4 w-4 mr-2" />
                    Connect Wallet
                  </Button>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Main Trading Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Chart */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {markets.map((market) => (
                        <SelectItem key={market.marketKey} value={market.marketKey}>
                          {market.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentMarket && (
                    <div className="text-right">
                      <p className="text-2xl font-bold">${currentMarket.indexPrice.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        Max {currentMarket.maxLeverage}× leverage
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-96 bg-muted/20 rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Chart integration coming soon</p>
                </div>
              </CardContent>
            </Card>

            {/* Positions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Open Positions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OpenPositionsTable 
                  chainId={chainId}
                  currentPrices={markets.reduce((acc, m) => ({ ...acc, [m.marketKey]: m.indexPrice }), {})}
                />
              </CardContent>
            </Card>

            {/* Order History */}
            <OrderHistory />
          </div>

          {/* Right: Order Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Place Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Buy/Sell Toggle */}
                <Tabs value={tradeMode} onValueChange={(v) => setTradeMode(v as 'buy' | 'sell')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Buy / Long
                    </TabsTrigger>
                    <TabsTrigger value="sell">
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Sell / Short
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Order Type */}
                <div>
                  <Label>Order Type</Label>
                  <Select value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="market">Market</SelectItem>
                      <SelectItem value="limit">Limit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Size */}
                <div>
                  <Label>Size</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={orderSize}
                    onChange={(e) => setOrderSize(e.target.value)}
                  />
                </div>

                {/* Limit Price (if limit order) */}
                {orderType === 'limit' && (
                  <div>
                    <Label>Limit Price</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                    />
                  </div>
                )}

                {/* Leverage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Leverage: {leverage}×</Label>
                    <span className="text-sm text-muted-foreground">
                      Max: {currentMarket?.maxLeverage || 50}×
                    </span>
                  </div>
                  <Slider
                    value={[leverage]}
                    onValueChange={([v]) => setLeverage(v)}
                    min={1}
                    max={currentMarket?.maxLeverage || 50}
                    step={1}
                  />
                </div>

                {/* Order Summary */}
                {orderSize && currentMarket && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Position Size</span>
                      <span className="font-medium">{orderSize} {selectedMarket}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Notional Value</span>
                      <span className="font-medium">
                        ${(parseFloat(orderSize) * currentMarket.indexPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Required Margin</span>
                      <span className="font-medium">
                        ${((parseFloat(orderSize) * currentMarket.indexPrice) / leverage).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Place Order Button */}
                <Button
                  className="w-full"
                  onClick={handlePlaceOrder}
                  disabled={orderLoading || !orderSize || !isCurrentWalletConnected}
                  variant={tradeMode === 'buy' ? 'default' : 'destructive'}
                >
                  {orderLoading ? (
                    'Placing Order...'
                  ) : (
                    `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${selectedMarket}`
                  )}
                </Button>

                {!isCurrentWalletConnected && (
                  <p className="text-sm text-muted-foreground text-center">
                    Connect wallet to trade
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Market Info */}
            {currentMarket && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Market Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Funding Rate (1h)</span>
                    <span className={currentMarket.fundingRate >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {(currentMarket.fundingRate * 100).toFixed(4)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Open Interest</span>
                    <span>${currentMarket.openInterest.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Maker Fee</span>
                    <span>{(currentMarket.makerFee * 100).toFixed(3)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taker Fee</span>
                    <span>{(currentMarket.takerFee * 100).toFixed(3)}%</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={showInternalWalletSetup} onOpenChange={setShowInternalWalletSetup}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Setup Internal Wallet</DialogTitle>
          </DialogHeader>
          <SecureWalletSetup onWalletCreated={handleInternalWalletCreated} />
        </DialogContent>
      </Dialog>

      <SnxAccountSetup
        isOpen={showSnxAccountSetup}
        onClose={() => setShowSnxAccountSetup(false)}
        onAccountCreated={handleAccountCreated}
        chainId={chainId}
      />

      <PasswordUnlockDialog
        open={showPasswordDialog}
        onUnlock={handlePasswordUnlock}
        onCancel={() => setShowPasswordDialog(false)}
      />
    </AppLayout>
  );
};

export default TradingDashboard;
