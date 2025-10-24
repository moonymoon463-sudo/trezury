import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useDydxMarkets } from '@/hooks/useDydxMarkets';
import { useDydxCandles } from '@/hooks/useDydxCandles';
import { useDydxWallet } from '@/hooks/useDydxWallet';
import { useDydxAccount } from '@/hooks/useDydxAccount';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, BarChart3, Settings, DollarSign, Zap, TrendingUpDown, RefreshCw, Copy, Check, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TradingViewChart from '@/components/trading/TradingViewChart';
import { OrderForm } from '@/components/trading/OrderForm';
import { OrderHistory } from '@/components/trading/OrderHistory';
import { PositionManager } from '@/components/trading/PositionManager';
import AurumLogo from '@/components/AurumLogo';
import SecureWalletSetup from '@/components/SecureWalletSetup';
import { DydxWalletSetup } from '@/components/trading/DydxWalletSetup';
import { DepositUSDC } from '@/components/trading/DepositUSDC';
import { useAuth } from '@/hooks/useAuth';

const TradingDashboard = () => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showInternalWalletSetup, setShowInternalWalletSetup] = useState(false);
  const [showDydxWalletSetup, setShowDydxWalletSetup] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>('BTC-USD');
  const [chartResolution, setChartResolution] = useState<string>('1HOUR');
  const [walletType, setWalletType] = useState<'internal' | 'dydx'>('dydx');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'trade' | 'orders' | 'positions'>('trade');
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  // dYdX wallet state
  const { hasDydxWallet, dydxAddress, loading: dydxWalletLoading, refresh: refreshDydxWallet } = useDydxWallet();
  const { accountInfo, loading: accountLoading, refresh: refreshAccount } = useDydxAccount(dydxAddress || undefined);
  
  // External wallet (MetaMask)
  const { wallet, connectWallet } = useWalletConnection();
  
  // Internal wallet (secure wallet) - for spot trading
  const { balances, totalValue, loading: internalLoading, isConnected: internalConnected, walletAddress: internalAddress, refreshBalances } = useWalletBalance();

  // Real dYdX market data
  const { markets, loading: marketsLoading } = useDydxMarkets();
  const { candles } = useDydxCandles(selectedAsset, chartResolution, 200);

  // Check for dYdX wallet on mount
  useEffect(() => {
    if (user && !dydxWalletLoading && !hasDydxWallet) {
      setShowDydxWalletSetup(true);
    }
  }, [user, hasDydxWallet, dydxWalletLoading]);

  // Filter leverage assets (BTC, ETH, SOL from dYdX)
  const leverageAssets = markets.filter(m => 
    ['BTC-USD', 'ETH-USD', 'SOL-USD'].includes(m.symbol)
  );

  // Spot trading assets (mock for now)
  const spotAssets = [
    { symbol: 'XAUT', name: 'Tether Gold', price: 2050.30, change24h: 0.12, leverageAvailable: false },
    { symbol: 'PAXG', name: 'PAX Gold', price: 2048.90, change24h: 0.15, leverageAvailable: false },
    { symbol: 'TRZ', name: 'Trezury Token', price: 1.05, change24h: 1.89, leverageAvailable: false },
  ];

  const currentAsset = leverageAssets.find(a => a.symbol === selectedAsset) || spotAssets.find(a => a.symbol === selectedAsset);

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
    if (walletType === 'dydx' && dydxAddress) {
      await refreshAccount();
    } else {
      await refreshBalances();
    }
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

  const handleDydxWalletCreated = async () => {
    setShowDydxWalletSetup(false);
    await refreshDydxWallet();
    toast({
      title: "dYdX Wallet Created",
      description: "Your trading wallet is ready!",
    });
  };

  // Build current prices map for PositionManager
  const currentPrices: Record<string, number> = {};
  markets.forEach(market => {
    currentPrices[market.symbol] = market.price;
  });

  // Get current wallet data based on selection
  const currentWalletAddress = walletType === 'internal' ? internalAddress : dydxAddress;
  const currentWalletBalance = walletType === 'internal' ? totalValue : (accountInfo?.freeCollateral || 0);
  const isCurrentWalletConnected = walletType === 'internal' ? internalConnected : hasDydxWallet;

  const chartResolutionMap: Record<string, string> = {
    '1m': '1MIN',
    '5m': '5MINS',
    '15m': '15MINS',
    '1h': '1HOUR',
    '4h': '4HOURS',
    '1d': '1DAY',
  };

  return (
    <div className="flex min-h-screen w-full bg-[#211d12]">
      {/* Left Sidebar */}
      <aside className="flex flex-col w-64 bg-[#211d12] border-r border-[#463c25] p-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 mb-8">
          <AurumLogo className="h-10 w-10" />
          <div className="flex flex-col">
            <h1 className="text-white text-lg font-bold leading-normal">Trezury</h1>
            <p className="text-[#c6b795] text-sm font-normal leading-normal">Trading Dashboard</p>
          </div>
        </div>

        {/* Portfolio Overview */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#463c25]">
            <WalletIcon className="h-5 w-5 text-white" />
            <p className="text-white text-sm font-medium leading-normal">Portfolio Overview</p>
          </div>
          
          {/* Wallet Type Toggle */}
          <div className="flex gap-1 bg-[#211d12] rounded-lg p-1">
            <button
              onClick={() => setWalletType('dydx')}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                walletType === 'dydx' 
                  ? 'bg-[#e6b951] text-black' 
                  : 'text-[#c6b795] hover:text-white'
              }`}
            >
              dYdX Trading
            </button>
            <button
              onClick={() => setWalletType('internal')}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                walletType === 'internal' 
                  ? 'bg-[#e6b951] text-black' 
                  : 'text-[#c6b795] hover:text-white'
              }`}
            >
              Spot Wallet
            </button>
          </div>

          {/* Wallet Info */}
          {(internalLoading || dydxWalletLoading || accountLoading) ? (
            <div className="pl-3 space-y-2">
              <Skeleton className="h-4 w-full bg-[#463c25]/30" />
              <Skeleton className="h-4 w-3/4 bg-[#463c25]/30" />
              <Skeleton className="h-4 w-1/2 bg-[#463c25]/30" />
            </div>
          ) : isCurrentWalletConnected ? (
            <>
              <div className="pl-3 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#c6b795] text-xs">Address:</span>
                    <button
                      onClick={() => currentWalletAddress && copyAddress(currentWalletAddress)}
                      className="flex items-center gap-1 text-white text-xs hover:text-[#e6b951] transition-colors"
                    >
                      {currentWalletAddress?.slice(0, 6)}...{currentWalletAddress?.slice(-4)}
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#c6b795] text-sm">Balance:</span>
                    <span className="text-white font-semibold">
                      ${currentWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {walletType === 'dydx' && accountInfo && (
                    <div className="space-y-1 pt-2 border-t border-[#463c25]">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#c6b795]">Equity:</span>
                        <span className="text-white">${accountInfo.equity.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#c6b795]">Open Positions:</span>
                        <span className="text-white">{accountInfo.openPositions}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#c6b795]">Unrealized PnL:</span>
                        <span className={accountInfo.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                          ${accountInfo.unrealizedPnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  {walletType === 'internal' && balances.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-[#463c25]">
                      {balances.filter(b => b.amount > 0).map((balance) => (
                        <div key={`${balance.asset}-${balance.chain}`} className="flex justify-between items-center text-xs">
                          <span className="text-[#c6b795]">{balance.asset} ({balance.chain}):</span>
                          <span className="text-white">{balance.amount.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                onClick={handleRefreshBalances}
                variant="ghost"
                size="sm"
                className="w-full text-[#c6b795] hover:text-white hover:bg-[#463c25]"
                disabled={internalLoading || accountLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(internalLoading || accountLoading) ? 'animate-spin' : ''}`} />
                Refresh Balances
              </Button>

              {walletType === 'dydx' && (
                <Button 
                  onClick={() => setShowDepositModal(true)}
                  className="w-full bg-[#e6b951]/20 text-[#e6b951] hover:bg-[#e6b951]/30 font-bold"
                >
                  Deposit USDC
                </Button>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-center py-4">
                {walletType === 'dydx' ? (
                  <>
                    <Shield className="h-12 w-12 mx-auto mb-3 text-[#e6b951]/40" />
                    <p className="text-white text-sm font-semibold mb-1">No dYdX Wallet</p>
                    <p className="text-[#c6b795] text-xs mb-3">
                      Create your dYdX trading wallet to start leveraged trading
                    </p>
                    <Button
                      onClick={() => setShowDydxWalletSetup(true)}
                      className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Create dYdX Wallet
                    </Button>
                  </>
                ) : (
                  <>
                    <Shield className="h-12 w-12 mx-auto mb-3 text-[#e6b951]/40" />
                    <p className="text-white text-sm font-semibold mb-1">No Internal Wallet Found</p>
                    <p className="text-[#c6b795] text-xs mb-3">
                      Create your secure internal wallet for spot trading
                    </p>
                    <Button
                      onClick={() => setShowInternalWalletSetup(true)}
                      className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Create Internal Wallet
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Assets List */}
        <p className="text-[#c6b795] text-xs font-bold uppercase tracking-wider px-3 mb-2">Assets</p>
        <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {marketsLoading ? (
            <>
              <Skeleton className="h-12 rounded-lg bg-[#463c25]/30" />
              <Skeleton className="h-12 rounded-lg bg-[#463c25]/30" />
              <Skeleton className="h-12 rounded-lg bg-[#463c25]/30" />
            </>
          ) : (
            <>
              {leverageAssets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => setSelectedAsset(asset.symbol)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg group transition-colors ${
                    selectedAsset === asset.symbol ? 'bg-[#463c25]' : 'hover:bg-[#463c25]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-white" />
                    <p className="text-white text-sm font-medium leading-normal">{asset.symbol.split('-')[0]}</p>
                  </div>
                  <span className={`text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
                    asset.changePercent24h > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {asset.changePercent24h > 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                  </span>
                </button>
              ))}
              {spotAssets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => setSelectedAsset(asset.symbol)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg group transition-colors ${
                    selectedAsset === asset.symbol ? 'bg-[#463c25]' : 'hover:bg-[#463c25]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-white" />
                    <p className="text-white text-sm font-medium leading-normal">{asset.symbol}</p>
                  </div>
                  <span className={`text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
                    asset.change24h > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Settings */}
        <div className="mt-auto">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#463c25] cursor-pointer">
            <Settings className="h-5 w-5 text-white" />
            <p className="text-white text-sm font-medium leading-normal">Settings</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-6 relative bg-[#211d12]">
        {/* Top Stats */}
        <div className="absolute top-6 right-6 z-10 flex gap-4 p-2 bg-[#2a251a]/50 backdrop-blur-sm rounded-lg border border-[#635636]/50">
          {isCurrentWalletConnected && accountInfo && (
            <>
              <div className="flex flex-col items-center px-2">
                <p className="text-[#c6b795] text-xs font-medium">Wallet Type</p>
                <p className="text-white text-base font-bold capitalize">{walletType}</p>
              </div>
              <div className="flex flex-col items-center px-2">
                <p className="text-[#c6b795] text-xs font-medium">Unrealized PnL</p>
                <p className={`text-base font-bold ${accountInfo.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {accountInfo.unrealizedPnl >= 0 ? '+' : ''}${accountInfo.unrealizedPnl.toFixed(2)}
                </p>
              </div>
              <div className="flex flex-col items-center px-2">
                <p className="text-[#c6b795] text-xs font-medium">Margin Usage</p>
                <p className="text-white text-base font-bold">{accountInfo.marginUsage.toFixed(1)}%</p>
              </div>
            </>
          )}
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex border-b border-[#463c25] gap-8 mb-6">
          <button className="flex flex-col items-center justify-center border-b-[3px] border-b-[#e6b951] text-white pb-[13px] pt-2">
            <p className="text-sm font-bold leading-normal tracking-[0.015em]">Leverage</p>
          </button>
          <button className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#c6b795] pb-[13px] pt-2 hover:text-white">
            <p className="text-sm font-bold leading-normal tracking-[0.015em]">Spot</p>
          </button>
          <button className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#c6b795] pb-[13px] pt-2 hover:text-white">
            <p className="text-sm font-bold leading-normal tracking-[0.015em]">Analytics</p>
          </button>
          <button className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#c6b795] pb-[13px] pt-2 hover:text-white">
            <p className="text-sm font-bold leading-normal tracking-[0.015em]">AI Insights</p>
          </button>
        </div>

        {/* Price Display */}
        {currentAsset && 'price' in currentAsset && (
          <div className="mb-4">
            <div className="flex items-baseline gap-4">
              <p className="text-[#c6b795] text-sm font-medium">{selectedAsset}</p>
              <h2 className="text-white text-5xl font-bold">
                {currentAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <div className="flex items-center gap-1">
                <span className="text-sm text-[#c6b795]">24h</span>
                <Badge variant={('changePercent24h' in currentAsset ? currentAsset.changePercent24h : (currentAsset as any).change24h) > 0 ? "default" : "destructive"} className="text-sm">
                  {('changePercent24h' in currentAsset ? currentAsset.changePercent24h : (currentAsset as any).change24h) > 0 ? '+' : ''}
                  {('changePercent24h' in currentAsset 
                    ? currentAsset.changePercent24h.toFixed(2) 
                    : (currentAsset as any).change24h
                  )}%
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Chart Controls */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map((interval) => (
              <Button
                key={interval}
                size="sm"
                variant="ghost"
                onClick={() => setChartResolution(chartResolutionMap[interval])}
                className={chartResolution === chartResolutionMap[interval] ? 'bg-[#463c25] text-white' : 'text-[#c6b795] hover:text-white hover:bg-[#463c25]/50'}
              >
                {interval}
              </Button>
            ))}
          </div>
        </div>

        {/* Chart Section */}
        <div className="flex-1 rounded-lg overflow-hidden bg-[#1a1712] border border-[#463c25] mb-6">
          {selectedAsset && leverageAssets.find(a => a.symbol === selectedAsset) ? (
            <TradingViewChart
              symbol={selectedAsset}
              candles={candles}
              resolution={chartResolution}
              onResolutionChange={setChartResolution}
            />
          ) : selectedAsset ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-24 w-24 mx-auto mb-4 text-[#e6b951]/40" />
                <h3 className="text-xl font-semibold text-[#e6b951] mb-2">Spot Trading Chart</h3>
                <p className="text-[#c6b795] max-w-md">
                  Chart for {selectedAsset} will be integrated with spot market data.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-24 w-24 mx-auto mb-4 text-[#e6b951]/40" />
                <h3 className="text-xl font-semibold text-[#e6b951] mb-2">Select an Asset</h3>
                <p className="text-[#c6b795] max-w-md">
                  Choose a trading pair from the left sidebar to view its chart.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right Sidebar - Order Panel */}
      <aside className="w-96 bg-[#2a251a] border-l border-[#463c25] p-4 overflow-y-auto">
        <h2 className="text-white text-xl font-bold mb-4">Trading Panel</h2>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-[#211d12] mb-4">
            <TabsTrigger value="trade" className="data-[state=active]:bg-[#e6b951] data-[state=active]:text-black">
              Trade
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-[#e6b951] data-[state=active]:text-black">
              Orders
            </TabsTrigger>
            <TabsTrigger value="positions" className="data-[state=active]:bg-[#e6b951] data-[state=active]:text-black">
              Positions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trade" className="mt-0">
            {hasDydxWallet && dydxAddress ? (
              <OrderForm
                address={dydxAddress}
                selectedMarket={selectedAsset || undefined}
                currentPrice={currentAsset && 'price' in currentAsset ? currentAsset.price : 0}
                availableBalance={currentWalletBalance}
                onOrderPlaced={() => {
                  refreshAccount();
                  setActiveTab('orders');
                }}
              />
            ) : (
              <div className="text-center py-12">
                <Shield className="h-16 w-16 mx-auto mb-4 text-[#e6b951]/40" />
                <h3 className="text-lg font-semibold text-white mb-2">dYdX Wallet Required</h3>
                <p className="text-[#c6b795] text-sm mb-4">
                  Create your dYdX trading wallet to start placing orders
                </p>
                <Button
                  onClick={() => setShowDydxWalletSetup(true)}
                  className="bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Create dYdX Wallet
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            {dydxAddress ? (
              <OrderHistory address={dydxAddress} />
            ) : (
              <div className="text-center py-12">
                <p className="text-[#c6b795]">Connect wallet to view orders</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="positions" className="mt-0">
            {dydxAddress ? (
              <PositionManager address={dydxAddress} currentPrices={currentPrices} />
            ) : (
              <div className="text-center py-12">
                <p className="text-[#c6b795]">Connect wallet to view positions</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </aside>

      {/* Internal Wallet Setup Dialog */}
      <Dialog open={showInternalWalletSetup} onOpenChange={setShowInternalWalletSetup}>
        <DialogContent className="bg-[#2a251a] border-[#463c25]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#e6b951]" />
              Create Your Internal Wallet
            </DialogTitle>
            <DialogDescription className="text-[#c6b795]">
              Set up your secure internal wallet for spot trading.
            </DialogDescription>
          </DialogHeader>
          <SecureWalletSetup onWalletCreated={handleInternalWalletCreated} />
        </DialogContent>
      </Dialog>

      {/* dYdX Wallet Setup Dialog */}
      <Dialog open={showDydxWalletSetup} onOpenChange={setShowDydxWalletSetup}>
        <DialogContent className="bg-[#2a251a] border-[#463c25]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#e6b951]" />
              Create Your dYdX Trading Wallet
            </DialogTitle>
            <DialogDescription className="text-[#c6b795]">
              Set up your secure dYdX wallet for leveraged trading.
            </DialogDescription>
          </DialogHeader>
          <DydxWalletSetup onComplete={handleDydxWalletCreated} />
        </DialogContent>
      </Dialog>

      {/* Deposit USDC Dialog */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent className="bg-[#2a251a] border-[#463c25]">
          <DialogHeader>
            <DialogTitle className="text-white">Deposit USDC</DialogTitle>
            <DialogDescription className="text-[#c6b795]">
              Transfer USDC to your dYdX trading wallet
            </DialogDescription>
          </DialogHeader>
          <DepositUSDC onDepositComplete={() => {
            setShowDepositModal(false);
            refreshAccount();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradingDashboard;
