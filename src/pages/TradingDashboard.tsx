import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useDydxMarkets } from '@/hooks/useDydxMarkets';
import { useDydxCandles } from '@/hooks/useDydxCandles';
import { useDydxWallet } from '@/hooks/useDydxWallet';
import { useDydxAccount } from '@/hooks/useDydxAccount';
import { useDydxTrading } from '@/hooks/useDydxTrading';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, BarChart3, Settings, DollarSign, Zap, TrendingUpDown, RefreshCw, Copy, Check, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';
import TradingViewChart from '@/components/trading/TradingViewChart';
import AurumLogo from '@/components/AurumLogo';
import SecureWalletSetup from '@/components/SecureWalletSetup';
import { DydxWalletSetup } from '@/components/trading/DydxWalletSetup';
import { DepositUSDC } from '@/components/trading/DepositUSDC';
import { DepositModal } from '@/components/trading/DepositModal';
import { WithdrawModal } from '@/components/trading/WithdrawModal';
import { PasswordUnlockDialog } from '@/components/trading/PasswordUnlockDialog';
import { OrderHistory } from '@/components/trading/OrderHistory';
import { PositionManager } from '@/components/trading/PositionManager';
import { dydxWalletService } from '@/services/dydxWalletService';
import { useAuth } from '@/hooks/useAuth';

const TradingDashboard = () => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showInternalWalletSetup, setShowInternalWalletSetup] = useState(false);
  const [showDydxWalletSetup, setShowDydxWalletSetup] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [tradingMode, setTradingMode] = useState<'spot' | 'leverage'>('leverage');
  const [selectedAsset, setSelectedAsset] = useState<string | null>('BTC-USD');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-limit'>('market');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | 'positions'>('buy');
  const [leverage, setLeverage] = useState(1);
  const [orderSize, setOrderSize] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [chartResolution, setChartResolution] = useState<string>('1HOUR');
  const [walletType, setWalletType] = useState<'internal' | 'external'>('internal');
  const [copied, setCopied] = useState(false);
  
  const { user, loading: authLoading } = useAuth();
  
  // Defensive auth check - should never reach here due to ProtectedRoute, but just in case
  if (!user && !authLoading) {
    window.location.href = '/auth?return=/trading-dashboard';
    return null;
  }
  const { getPassword } = useTradingPasswordContext();
  
  // External wallet (MetaMask)
  const { wallet, connectWallet } = useWalletConnection();
  
  // Internal wallet (secure wallet) - automatically loads existing wallet from gold app
  const { balances, totalValue, loading: internalLoading, isConnected: internalConnected, walletAddress: internalAddress, refreshBalances } = useWalletBalance();
  
  // dYdX wallet and account
  const { hasDydxWallet, dydxAddress, loading: dydxWalletLoading, refresh: refreshDydxWallet } = useDydxWallet();
  const { accountInfo, loading: accountLoading, refresh: refreshAccount } = useDydxAccount(dydxAddress || undefined, true);
  
  // dYdX trading
  const { placeOrder, orderLoading } = useDydxTrading(dydxAddress || undefined);
  
  const { toast } = useToast();

  // Show dYdX wallet setup if user doesn't have one
  useEffect(() => {
    if (user && !dydxWalletLoading && !hasDydxWallet) {
      setShowDydxWalletSetup(true);
    }
  }, [user, hasDydxWallet, dydxWalletLoading]);

  // Show deposit modal if dYdX wallet exists but balance is 0
  useEffect(() => {
    if (hasDydxWallet && accountInfo && accountInfo.equity === 0) {
      setShowDepositModal(true);
    }
  }, [hasDydxWallet, accountInfo]);

  // Real dYdX market data
  const { markets, loading: marketsLoading } = useDydxMarkets();
  const { candles, loading: candlesLoading, error: candlesError, loadMore } = useDydxCandles(selectedAsset, chartResolution, 200);

  // Debug log for chart data flow
  console.log('[TradingDashboard] Chart data', { 
    selectedAsset, 
    chartResolution, 
    candlesLength: candles?.length || 0,
    candlesLoading,
    candlesError 
  });

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
    await refreshBalances();
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

  // Get current wallet data based on selection (use dYdX account for trading)
  const currentWalletAddress = dydxAddress || (walletType === 'internal' ? internalAddress : wallet.address);
  const currentWalletBalance = accountInfo?.equity || (walletType === 'internal' ? totalValue : parseFloat(wallet.balance || '0'));
  const availableBalance = accountInfo?.freeCollateral || currentWalletBalance;
  const isCurrentWalletConnected = hasDydxWallet && !!dydxAddress;

  const handlePlaceOrder = async () => {
    if (!selectedAsset || !orderSize) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please enter order size'
      });
      return;
    }

    setShowPasswordDialog(true);
  };

  const handlePasswordUnlock = async (password: string) => {
    setShowPasswordDialog(false);

    if (!selectedAsset) return;

    const currentPrice = currentAsset && 'price' in currentAsset ? currentAsset.price : 0;

    const response = await placeOrder({
      market: selectedAsset,
      side: tradeMode === 'buy' ? 'BUY' : 'SELL',
      type: orderType === 'market' ? 'MARKET' : 'LIMIT',
      size: parseFloat(orderSize),
      price: orderType === 'limit' ? parseFloat(limitPrice) : currentPrice,
      leverage,
      password
    });

    if (response.success) {
      setOrderSize('');
      setLimitPrice('');
      refreshAccount();
    }
  };

  const handleTradingModeChange = (mode: 'spot' | 'leverage') => {
    setTradingMode(mode);
    // Auto-select first asset in the new mode
    if (mode === 'spot') {
      setSelectedAsset('XAUT');
    } else {
      setSelectedAsset('BTC-USD');
    }
  };

  const currentPrices = markets.reduce((acc, market) => {
    acc[market.symbol] = market.price;
    return acc;
  }, {} as Record<string, number>);

  const chartResolutionMap: Record<string, string> = {
    '1m': '1MIN',
    '5m': '5MINS',
    '15m': '15MINS',
    '1h': '1HOUR',
    '4h': '4HOURS',
    '1d': '1DAY',
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#211d12]">
      {/* Left Sidebar */}
      <aside className="flex flex-col w-64 bg-[#211d12] border-r border-[#463c25] p-4 overflow-y-auto">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 mb-8">
          <AurumLogo className="h-16 w-16" />
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
              onClick={() => setWalletType('internal')}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                walletType === 'internal' 
                  ? 'bg-[#e6b951] text-black' 
                  : 'text-[#c6b795] hover:text-white'
              }`}
            >
              Internal Wallet
            </button>
            <button
              onClick={() => setWalletType('external')}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                walletType === 'external' 
                  ? 'bg-[#e6b951] text-black' 
                  : 'text-[#c6b795] hover:text-white'
              }`}
            >
              External Wallet
            </button>
          </div>

          {/* Wallet Info - Always show wallet type selector */}
          {walletType === 'internal' ? (
            internalAddress ? (
              <>
                <div className="pl-3 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#c6b795] text-xs">Internal Address:</span>
                      <button
                        onClick={() => internalAddress && copyAddress(internalAddress)}
                        className="flex items-center gap-1 text-white text-xs hover:text-[#e6b951] transition-colors"
                      >
                        {internalAddress?.slice(0, 6)}...{internalAddress?.slice(-4)}
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#c6b795] text-sm">Balance:</span>
                      <span className="text-white font-semibold">
                        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {balances.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-[#463c25]">
                        {balances.filter(b => b.amount > 0).map((balance) => (
                          <div key={`${balance.asset}-${balance.chain}`} className="flex justify-between items-center text-xs">
                            <span className="text-[#c6b795]">{balance.asset}:</span>
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
                  disabled={internalLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${internalLoading ? 'animate-spin' : ''}`} />
                  Refresh Balances
                </Button>

                {hasDydxWallet && (
                  <>
                    <Button 
                      onClick={() => setShowDepositModal(true)}
                      className="w-full bg-[#e6b951]/20 text-[#e6b951] hover:bg-[#e6b951]/30 font-bold"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Deposit to Trading
                    </Button>
                    <Button 
                      onClick={() => setShowWithdrawModal(true)}
                      variant="outline" 
                      className="w-full border-[#e6b951]/50 text-[#e6b951] hover:bg-[#e6b951]/10 font-bold"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Withdraw from Trading
                    </Button>
                  </>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <Shield className="h-12 w-12 mx-auto mb-3 text-[#e6b951]/40" />
                  <p className="text-white text-sm font-semibold mb-1">No Internal Wallet Found</p>
                  <p className="text-[#c6b795] text-xs mb-3">
                    Create your secure internal wallet to start trading
                  </p>
                  <Button
                    onClick={() => setShowInternalWalletSetup(true)}
                    className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Create Internal Wallet
                  </Button>
                </div>
              </div>
            )
          ) : (
            wallet.isConnected ? (
              <>
                <div className="pl-3 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#c6b795] text-xs">External Address:</span>
                      <button
                        onClick={() => wallet.address && copyAddress(wallet.address)}
                        className="flex items-center gap-1 text-white text-xs hover:text-[#e6b951] transition-colors"
                      >
                        {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#c6b795] text-sm">Balance:</span>
                      <span className="text-white font-semibold">
                        {wallet.balance} ETH
                      </span>
                    </div>
                  </div>
                </div>

                {hasDydxWallet && (
                  <>
                    <Button 
                      onClick={() => setShowDepositModal(true)}
                      className="w-full bg-[#e6b951]/20 text-[#e6b951] hover:bg-[#e6b951]/30 font-bold"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Deposit to Trading
                    </Button>
                    <Button 
                      onClick={() => setShowWithdrawModal(true)}
                      variant="outline" 
                      className="w-full border-[#e6b951]/50 text-[#e6b951] hover:bg-[#e6b951]/10 font-bold"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Withdraw from Trading
                    </Button>
                  </>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <WalletIcon className="h-12 w-12 mx-auto mb-3 text-[#e6b951]/40" />
                  <p className="text-white text-sm font-semibold mb-1">External Wallet Not Connected</p>
                  <p className="text-[#c6b795] text-xs mb-3">
                    Connect MetaMask to trade with your external wallet
                  </p>
                  <Button
                    onClick={handleConnectWallet}
                    className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
                  >
                    <WalletIcon className="h-4 w-4 mr-2" />
                    Connect MetaMask
                  </Button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Assets List */}
        <p className="text-[#c6b795] text-xs font-bold uppercase tracking-wider px-3 mb-2">
          {tradingMode === 'spot' ? 'Spot Assets' : 'Leverage Assets'}
        </p>
        <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {marketsLoading ? (
            <>
              <Skeleton className="h-12 rounded-lg bg-[#463c25]/30" />
              <Skeleton className="h-12 rounded-lg bg-[#463c25]/30" />
              <Skeleton className="h-12 rounded-lg bg-[#463c25]/30" />
            </>
          ) : (
            <>
              {tradingMode === 'leverage' && leverageAssets.map((asset) => (
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
              {tradingMode === 'spot' && spotAssets.map((asset) => (
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
      <main className="flex-1 flex flex-col p-3 relative bg-[#211d12] overflow-hidden">
        {/* Top Stats */}
        <div className="flex gap-2 p-1.5 bg-[#2a251a]/50 backdrop-blur-sm rounded-lg border border-[#635636]/50 mb-2 ml-auto flex-shrink-0">
          {isCurrentWalletConnected && (
            <>
              <div className="flex flex-col items-center px-1.5">
                <p className="text-[#c6b795] text-[10px] font-medium">Wallet</p>
                <p className="text-white text-xs font-bold capitalize">{walletType}</p>
              </div>
              <div className="flex flex-col items-center px-1.5">
                <p className="text-[#c6b795] text-[10px] font-medium">P&L</p>
                <p className="text-green-400 text-xs font-bold">+$1.2K</p>
              </div>
              <div className="flex flex-col items-center px-1.5">
                <p className="text-[#c6b795] text-[10px] font-medium">Funding</p>
                <p className="text-white text-xs font-bold">0.01%</p>
              </div>
            </>
          )}
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex border-b border-[#463c25] gap-6 mb-2 flex-shrink-0">
          <button 
            onClick={() => handleTradingModeChange('spot')}
            className={`flex flex-col items-center justify-center border-b-2 pb-2 pt-1 ${
              tradingMode === 'spot' 
                ? 'border-b-[#e6b951] text-white' 
                : 'border-b-transparent text-[#c6b795] hover:text-white'
            }`}
          >
            <p className="text-xs font-bold">Spot</p>
          </button>
          <button 
            onClick={() => handleTradingModeChange('leverage')}
            className={`flex flex-col items-center justify-center border-b-2 pb-2 pt-1 ${
              tradingMode === 'leverage' 
                ? 'border-b-[#e6b951] text-white' 
                : 'border-b-transparent text-[#c6b795] hover:text-white'
            }`}
          >
            <p className="text-xs font-bold">Leverage</p>
          </button>
          <button className="flex flex-col items-center justify-center border-b-2 border-b-transparent text-[#c6b795] pb-2 pt-1 hover:text-white">
            <p className="text-xs font-bold">Analytics</p>
          </button>
          <button className="flex flex-col items-center justify-center border-b-2 border-b-transparent text-[#c6b795] pb-2 pt-1 hover:text-white">
            <p className="text-xs font-bold">AI Insights</p>
          </button>
        </div>

        {/* Price Display */}
        {currentAsset && 'price' in currentAsset && (
          <div className="mb-2 flex-shrink-0">
            <div className="flex items-baseline gap-2">
              <p className="text-[#c6b795] text-xs font-medium">{selectedAsset}</p>
              <h2 className="text-white text-2xl font-outfit font-light tracking-tight">
                {currentAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <Badge variant={('changePercent24h' in currentAsset ? currentAsset.changePercent24h : (currentAsset as any).change24h) > 0 ? "default" : "destructive"} className="text-xs">
                {('changePercent24h' in currentAsset ? currentAsset.changePercent24h : (currentAsset as any).change24h) > 0 ? '+' : ''}
                {('changePercent24h' in currentAsset 
                  ? currentAsset.changePercent24h.toFixed(2) 
                  : (currentAsset as any).change24h
                )}%
              </Badge>
            </div>
          </div>
        )}

        {/* Chart Controls */}
        <div className="flex items-center gap-1 mb-2 flex-shrink-0">
          <div className="flex gap-0.5">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map((interval) => (
              <Button
                key={interval}
                size="sm"
                variant="ghost"
                onClick={() => setChartResolution(chartResolutionMap[interval])}
                className={`h-6 px-2 text-[10px] ${chartResolution === chartResolutionMap[interval] ? 'bg-[#463c25] text-white' : 'text-[#c6b795] hover:text-white hover:bg-[#463c25]/50'}`}
              >
                {interval}
              </Button>
            ))}
          </div>
        </div>

        {/* Chart Section */}
        <div className="flex-1 min-h-[350px] rounded-lg overflow-hidden bg-[#1a1712] border border-[#463c25] mb-2">
          {selectedAsset && leverageAssets.find(a => a.symbol === selectedAsset) ? (
            <TradingViewChart
              symbol={selectedAsset}
              candles={candles}
              resolution={chartResolution}
              onResolutionChange={setChartResolution}
              loading={candlesLoading}
              error={candlesError}
              onLoadMore={loadMore}
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

        {/* AI Insights Section - Compact */}
        <Card className="bg-[#2a251a] border-[#463c25] flex-shrink-0">
          <div className="p-2">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-white text-xs font-semibold">AI Insights</h3>
              <Badge className="bg-[#e6b951]/20 text-[#e6b951] text-[10px] px-1.5 py-0">
                Live
              </Badge>
            </div>
            <div className="bg-[#1a1712] rounded p-2 border border-[#463c25]">
              <p className="text-[#c6b795] text-[10px] leading-relaxed">
                Market rhythm suggests energy buildup — possible BTC long in 12h window.
              </p>
            </div>
          </div>
        </Card>
      </main>

      {/* Right Sidebar - Order Panel */}
      <aside className="w-80 bg-[#2a251a] border-l border-[#463c25] p-4 overflow-y-auto flex-shrink-0">
        <h2 className="text-white text-lg font-bold mb-3">Order Panel</h2>

        <Tabs value={tradeMode} onValueChange={(v) => setTradeMode(v as 'buy' | 'sell' | 'positions')} className="mb-3">
          <TabsList className="grid w-full grid-cols-3 bg-[#211d12]">
            <TabsTrigger value="buy" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Buy</TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Sell</TabsTrigger>
            <TabsTrigger value="positions" className="data-[state=active]:bg-[#e6b951] data-[state=active]:text-black">Positions</TabsTrigger>
          </TabsList>
        </Tabs>

        {tradeMode !== 'positions' ? (
          <div className="space-y-3">
            {/* Order Type */}
            <div>
              <label className="text-[#c6b795] text-xs font-medium mb-1.5 block">Order Type</label>
              <Select value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                <SelectTrigger className="bg-[#211d12] border-[#463c25] text-white">
                  <SelectValue placeholder="Market Order" />
                </SelectTrigger>
                <SelectContent className="bg-[#211d12] border-[#463c25]">
                  <SelectItem value="market" className="text-white">Market Order</SelectItem>
                  <SelectItem value="limit" className="text-white">Limit Order</SelectItem>
                  <SelectItem value="stop-limit" className="text-white">Stop Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
            <div>
              <label className="text-[#c6b795] text-xs font-medium mb-1.5 block">Price (USDT)</label>
              <input
                type="text"
                value={orderType === 'market' ? 'Market' : limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                disabled={orderType === 'market'}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-[#211d12] border border-[#463c25] rounded-lg text-white text-sm focus:border-[#e6b951] focus:ring-1 focus:ring-[#e6b951]"
              />
            </div>

            {/* Order Size */}
            <div>
              <label className="text-[#c6b795] text-xs font-medium mb-1.5 block">Order Size ({selectedAsset?.split('-')[0] || 'BTC'})</label>
              <input
                type="number"
                placeholder="0.00"
                value={orderSize}
                onChange={(e) => setOrderSize(e.target.value)}
                className="w-full px-3 py-2 bg-[#211d12] border border-[#463c25] rounded-lg text-white text-sm focus:border-[#e6b951] focus:ring-1 focus:ring-[#e6b951]"
              />
              {/* Percentage Buttons */}
              <div className="flex gap-1.5 mt-2">
                {['0%', '25%', '50%', '75%', '100%'].map((pct) => (
                  <Button
                    key={pct}
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-xs bg-[#211d12] text-[#c6b795] hover:bg-[#463c25] hover:text-white"
                  >
                    {pct}
                  </Button>
                ))}
              </div>
              {/* Slider */}
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                className="w-full mt-2 accent-[#e6b951]"
              />
            </div>

            {/* Leverage */}
            {selectedAsset && leverageAssets.find(a => a.symbol === selectedAsset) && (
              <div>
                <label className="text-[#c6b795] text-xs font-medium mb-1.5 block">Leverage</label>
                <div className="flex gap-1.5 mb-2">
                  {['1x', '5x', '10x', '15x', '20x'].map((lvg) => (
                    <Button
                      key={lvg}
                      size="sm"
                      variant={leverage === parseInt(lvg) ? "default" : "ghost"}
                      onClick={() => setLeverage(parseInt(lvg))}
                      className={leverage === parseInt(lvg) 
                        ? 'flex-1 text-xs bg-[#e6b951] text-black' 
                        : 'flex-1 text-xs bg-[#211d12] text-[#c6b795] hover:bg-[#463c25] hover:text-white'
                      }
                    >
                      {lvg}
                    </Button>
                  ))}
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full accent-[#e6b951]"
                />
              </div>
            )}

            {/* Total and Available */}
            <div className="space-y-1.5 pt-3 border-t border-[#463c25]">
              <div className="flex justify-between text-sm">
                <span className="text-[#c6b795]">Total:</span>
                <span className="text-white font-semibold">
                  {currentWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#c6b795]">Available:</span>
                <span className="text-white font-semibold">
                  {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#c6b795]">Source:</span>
                <span className="text-[#e6b951] font-semibold capitalize">{walletType}</span>
              </div>
            </div>

            {/* Confirm Button */}
            {isCurrentWalletConnected ? (
              <Button
                onClick={handlePlaceOrder}
                className={`w-full h-11 font-bold text-base ${
                  tradeMode === 'buy' 
                    ? 'bg-[#e6b951] hover:bg-[#d4a840] text-black' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                disabled={!selectedAsset || !orderSize || orderLoading}
              >
                {orderLoading ? 'Placing Order...' : `Confirm ${tradeMode === 'buy' ? 'Buy' : 'Sell'}`}
              </Button>
            ) : (
              <Button
                onClick={() => setShowDydxWalletSetup(true)}
                className="w-full h-11 font-bold bg-[#e6b951] hover:bg-[#d4a840] text-black text-base"
              >
                <Shield className="h-5 w-5 mr-2" />
                Set Up Trading Wallet
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {dydxAddress ? (
              <>
                <PositionManager address={dydxAddress} currentPrices={currentPrices} />
                <OrderHistory address={dydxAddress} />
              </>
            ) : (
              <div className="text-center py-12">
                <TrendingUpDown className="h-16 w-16 mx-auto mb-4 text-[#e6b951]/40" />
                <h3 className="text-lg font-semibold text-white mb-2">No Trading Wallet</h3>
                <p className="text-[#c6b795] text-sm mb-4">
                  Set up your dYdX trading wallet to view positions.
                </p>
                <Button
                  onClick={() => setShowDydxWalletSetup(true)}
                  className="bg-[#e6b951] hover:bg-[#d4a840] text-black"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Set Up Trading Wallet
                </Button>
              </div>
            )}
          </div>
        )}
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
              Set up your secure internal wallet instantly. If you already have a wallet from the gold app, it will be automatically loaded.
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
              Set Up Trading Wallet
            </DialogTitle>
            <DialogDescription className="text-[#c6b795]">
              Create your dYdX trading wallet to start trading with leverage.
            </DialogDescription>
          </DialogHeader>
          <DydxWalletSetup 
            onComplete={() => {
              setShowDydxWalletSetup(false);
              refreshDydxWallet();
            }} 
          />
        </DialogContent>
      </Dialog>

      {/* Password Unlock Dialog */}
      <PasswordUnlockDialog
        open={showPasswordDialog}
        onUnlock={handlePasswordUnlock}
        onCancel={() => setShowPasswordDialog(false)}
      />

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        dydxAddress={dydxAddress || ''}
        internalAddress={internalAddress}
        externalAddress={wallet.address}
        onDepositComplete={() => {
          refreshAccount();
          refreshBalances();
          setShowDepositModal(false);
        }}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        dydxAddress={dydxAddress || ''}
        availableBalance={accountInfo?.freeCollateral || 0}
        internalAddress={internalAddress}
        onWithdrawComplete={() => {
          refreshAccount();
          refreshBalances();
          setShowWithdrawModal(false);
        }}
      />
    </div>
  );
};

export default TradingDashboard;
