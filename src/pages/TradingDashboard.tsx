import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useHyperliquidMarkets } from '@/hooks/useHyperliquidMarkets';
import { useHyperliquidCandles } from '@/hooks/useHyperliquidCandles';
import { useHyperliquidAccount } from '@/hooks/useHyperliquidAccount';
import { useHyperliquidTrading } from '@/hooks/useHyperliquidTrading';
import { useHyperliquidFunding } from '@/hooks/useHyperliquidFunding';
import { useHyperliquidWalletDetection } from '@/hooks/useHyperliquidWalletDetection';
import { useHyperliquidTicker } from '@/hooks/useHyperliquidTicker';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, BarChart3, Settings, DollarSign, Zap, TrendingUpDown, RefreshCw, Copy, Check, Shield, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';
import { useNavigate } from 'react-router-dom';
import TradingViewChart from '@/components/trading/TradingViewChart';
import AurumLogo from '@/components/AurumLogo';
import SecureWalletSetup from '@/components/SecureWalletSetup';
import { DepositHyperliquidBridge } from '@/components/trading/DepositHyperliquidBridge';
import { HyperliquidWalletGenerator } from '@/components/trading/HyperliquidWalletGenerator';
import { WithdrawModal } from '@/components/trading/WithdrawModal';
import { PasswordUnlockDialog } from '@/components/trading/PasswordUnlockDialog';
import { OrderHistory } from '@/components/trading/OrderHistory';

import { PositionManager } from '@/components/trading/PositionManager';
import { OpenPositionsTable } from '@/components/trading/OpenPositionsTable';
import { OrderBook } from '@/components/trading/OrderBook';
import { FundingRateDisplay } from '@/components/trading/FundingRateDisplay';
import { ConnectionHealthBanner } from '@/components/trading/ConnectionHealthBanner';
import { hyperliquidWebSocketService } from '@/services/hyperliquidWebSocketService';
import { tradeAuditService } from '@/services/tradeAuditService';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const TradingDashboard = () => {
  const navigate = useNavigate();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showInternalWalletSetup, setShowInternalWalletSetup] = useState(false);
  const [showWalletGenerator, setShowWalletGenerator] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  const [tradingMode, setTradingMode] = useState<'spot' | 'leverage'>('leverage');
  const [selectedAsset, setSelectedAsset] = useState<string | null>('BTC');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-limit'>('market');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | 'positions'>('buy');
  const [leverage, setLeverage] = useState(1);
  const [orderSize, setOrderSize] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [chartResolution, setChartResolution] = useState<string>(() => {
    // Load persisted chart resolution from localStorage
    const saved = localStorage.getItem(`chart_resolution_${selectedAsset}`);
    return saved || '1HOUR';
  });
  const [walletType, setWalletType] = useState<'trading' | 'internal' | 'external'>('trading');
  const [copied, setCopied] = useState(false);
  const [wsHealth, setWsHealth] = useState({ isConnected: true, reconnectAttempts: 0, maxAttempts: 5 });
  
  const { user, loading: authLoading } = useAuth();
  const { getPassword } = useTradingPasswordContext();
  
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
  
  // External wallet (MetaMask)
  const { wallet, connectWallet, connecting } = useWalletConnection();
  
  // Internal wallet (secure wallet) - automatically loads existing wallet from gold app
  const { balances, totalValue, loading: internalLoading, isConnected: internalConnected, walletAddress: internalAddress, refreshBalances } = useWalletBalance();
  
  // Hyperliquid wallet and account
  const [hyperliquidAddress, setHyperliquidAddress] = useState<string | null>(null);
  
  // Smart wallet detection (checks both generated and external wallets)
  const { tradingWallet, loading: walletDetectionLoading, refresh: refreshWalletDetection } = useHyperliquidWalletDetection();
  
  // Use detected trading wallet address for account info
  const { accountInfo, loading: accountLoading, refresh: refreshAccount } = useHyperliquidAccount(tradingWallet.address || undefined);
  
  // Load Hyperliquid wallet
  useEffect(() => {
    const loadHyperliquidWallet = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('hyperliquid_wallets')
        .select('address')
        .eq('user_id', user.id)
        .single();
      if (data?.address) {
        setHyperliquidAddress(data.address);
      }
    };
    loadHyperliquidWallet();
  }, [user?.id]);
  
  // Hyperliquid trading - use detected wallet address
  const { placeOrder, loading: tradingLoading, orderLoading, assetMapperReady } = useHyperliquidTrading(tradingWallet.address || undefined);
  
  const { toast } = useToast();
  

  // Remove dYdX wallet setup - using direct Hyperliquid connection

  // Real Hyperliquid market data
  const { markets, loading: marketsLoading } = useHyperliquidMarkets();
  const { candles, loading: candlesLoading, error: candlesError, loadMoreHistory, isLoadingMore } = useHyperliquidCandles(selectedAsset, chartResolution, 500);
  const { fundingRate, nextFundingTime, formatTimeUntil } = useHyperliquidFunding(selectedAsset || '');
  const { prices: currentPrices } = useHyperliquidTicker();

  // WebSocket health monitoring
  useEffect(() => {
    const wsService = hyperliquidWebSocketService;
    
    const checkHealth = () => {
      setWsHealth({
        isConnected: wsService.isConnected(),
        reconnectAttempts: wsService.getReconnectAttempts(),
        maxAttempts: 5
      });
    };
    
    // Initial check
    checkHealth();
    
    // Check every 5 seconds
    const interval = setInterval(checkHealth, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Debug log for chart data flow
  console.log('[TradingDashboard] Chart data', { 
    selectedAsset, 
    chartResolution, 
    candlesLength: candles?.length || 0,
    candlesLoading,
    candlesError
  });

  // Filter leverage assets - prioritize BTC, ETH, SOL, then high liquidity markets
  const leverageAssets = Array.isArray(markets) && markets.length > 0 
    ? (() => {
        const priority = ['BTC', 'ETH', 'SOL'];
        const priorityMarkets = priority
          .map(name => markets.find(m => m.name === name))
          .filter(Boolean);
        
        console.log('[TradingDashboard] Leverage assets loaded:', {
          totalMarkets: markets.length,
          priorityCount: priorityMarkets.length,
          marketNames: priorityMarkets.map(m => m?.name)
        });
        
        return priorityMarkets;
      })()
    : [];
  
  console.log('[TradingDashboard] Markets state:', {
    marketsLoading,
    marketsCount: markets?.length || 0,
    leverageAssetsCount: leverageAssets.length
  });

  // Spot trading assets (mock for now)
  const spotAssets = [
    { symbol: 'XAUT', name: 'Tether Gold', price: 2050.30, change24h: 0.12, leverageAvailable: false },
    { symbol: 'PAXG', name: 'PAX Gold', price: 2048.90, change24h: 0.15, leverageAvailable: false },
    { symbol: 'TRZ', name: 'Trezury Token', price: 1.05, change24h: 1.89, leverageAvailable: false },
  ];

  const selectedSymbol = selectedAsset?.split('-')[0] || selectedAsset || '';
  const currentAsset = leverageAssets.find(a => a.name === selectedSymbol) || spotAssets.find(a => a.symbol === selectedAsset);

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      setShowWalletModal(false);
      
      // Auto-switch to external wallet view after connection
      setWalletType('external');
      
      toast({
        title: "MetaMask Connected Successfully",
        description: `Connected to ${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}`,
      });
    } catch (error) {
      console.error('Wallet connection error:', error);
      toast({
        title: "MetaMask Connection Failed",
        description: error instanceof Error ? error.message : "Please ensure MetaMask is installed and try again.",
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

  const handleWalletGenerated = async (address: string) => {
    setShowWalletGenerator(false);
    await refreshWalletDetection();
    toast({
      title: "Trading Wallet Created",
      description: "Your Hyperliquid trading wallet is ready!",
    });
  };

  // Prepare wallet data for transfer modal
  const availableWallets = [
    ...(hyperliquidAddress && accountInfo ? [{
      type: 'hyperliquid' as const,
      address: hyperliquidAddress,
      balance: parseFloat(accountInfo.marginSummary.accountValue) || 0,
      label: 'Hyperliquid Trading Wallet'
    }] : []),
    ...(internalAddress ? [{
      type: 'internal' as const,
      address: internalAddress,
      balance: totalValue,
      label: 'Internal Wallet (Gold App)'
    }] : []),
    ...(wallet.address ? [{
      type: 'evm' as const,
      address: wallet.address,
      balance: parseFloat(wallet.balance || '0'),
      label: 'External Wallet (MetaMask)'
    }] : [])
  ];

  // Get current wallet data based on selection (use Hyperliquid account for trading)
  const currentWalletAddress = hyperliquidAddress || (walletType === 'internal' ? internalAddress : wallet.address);
  const currentWalletBalance = accountInfo ? parseFloat(accountInfo.marginSummary.accountValue) : (walletType === 'internal' ? totalValue : parseFloat(wallet.balance || '0'));
  const availableBalance = accountInfo ? parseFloat(accountInfo.withdrawable) : currentWalletBalance;
  const isCurrentWalletConnected = !!hyperliquidAddress;

  const handlePlaceOrder = async () => {
    if (!selectedAsset || !orderSize) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please enter order size'
      });
      return;
    }

    // If using external wallet (MetaMask), no password needed
    if (tradingWallet.type === 'external') {
      await executePlaceOrder(null);
    } else {
      // Generated wallet requires password
      setShowPasswordDialog(true);
    }
  };

  const executePlaceOrder = async (password: string | null) => {
    if (!selectedAsset) return;

    const currentPrice = currentAsset && 'price' in currentAsset ? currentAsset.price : 0;
    const size = parseFloat(orderSize);
    const price = orderType === 'limit' ? parseFloat(limitPrice) : currentPrice;

    const response = await placeOrder({
      market: selectedAsset,
      side: tradeMode === 'buy' ? 'BUY' : 'SELL',
      type: orderType === 'market' ? 'MARKET' : orderType === 'stop-limit' ? 'STOP_LIMIT' : 'LIMIT',
      size,
      price,
      leverage,
      password: password || undefined,
      walletSource: tradingWallet.type || 'generated'
    });

    // Log to audit trail
    await tradeAuditService.logOrderPlacement(
      selectedAsset,
      orderType,
      tradeMode === 'buy' ? 'BUY' : 'SELL',
      size,
      price,
      leverage,
      response.success,
      response.error
    );

    if (response.success) {
      setOrderSize('');
      setLimitPrice('');
      setStopPrice('');
      refreshAccount();
      refreshWalletDetection();
      
      toast({
        title: 'Order Placed',
        description: 'Your order has been placed successfully'
      });
    }
  };

  const handlePasswordUnlock = async (password: string) => {
    setShowPasswordDialog(false);
    await executePlaceOrder(password);
  };

  const handleTradingModeChange = (mode: 'spot' | 'leverage') => {
    setTradingMode(mode);
    // Auto-select first asset in the new mode
    if (mode === 'spot') {
      setSelectedAsset('XAUT');
    } else {
      setSelectedAsset('BTC');
    }
  };

  // Persist chart resolution to localStorage when it changes
  useEffect(() => {
    if (selectedAsset && chartResolution) {
      localStorage.setItem(`chart_resolution_${selectedAsset}`, chartResolution);
    }
  }, [chartResolution, selectedAsset]);

  // Load persisted resolution when switching assets
  useEffect(() => {
    if (selectedAsset) {
      const saved = localStorage.getItem(`chart_resolution_${selectedAsset}`);
      if (saved) {
        setChartResolution(saved);
      }
    }
  }, [selectedAsset]);

  // Get max leverage for current market
  const getMaxLeverage = (market: string): number => {
    const symbol = market?.split('-')[0] || market;
    // BTC and ETH can go up to 50x, most alts 20x, stablecoins 10x
    if (['BTC', 'ETH'].includes(symbol)) return 50;
    if (['SOL', 'AVAX', 'MATIC'].includes(symbol)) return 20;
    return 10;
  };

  // Validate and enforce leverage limits
  useEffect(() => {
    if (selectedAsset) {
      const maxLev = getMaxLeverage(selectedAsset);
      if (leverage > maxLev) {
        setLeverage(maxLev);
        toast({
          title: "Leverage Adjusted",
          description: `Maximum leverage for ${selectedAsset} is ${maxLev}x`,
        });
      }
    }
  }, [selectedAsset]);

  // Auto-populate limit price when switching to limit order
  useEffect(() => {
    if (orderType === 'limit' && !limitPrice && currentAsset && 'price' in currentAsset) {
      setLimitPrice(currentAsset.price.toString());
    }
  }, [orderType]);

  // currentPrices now comes from useHyperliquidTicker hook

  // Note: chartResolution is already in the correct format ('1HOUR', '5MINS', etc.)
  // It's passed directly to useHyperliquidCandles which handles the normalization
  
  // Mapping for timeframe buttons
  const intervalToResolution: Record<string, string> = {
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
      <aside className="flex flex-col w-64 bg-[#211d12] border-r border-[#463c25] p-3 overflow-hidden flex-shrink-0">
        {/* Logo & Title */}
        <div className="flex items-center gap-2 mb-4">
          <AurumLogo className="h-16 w-16" />
          <div className="flex flex-col">
            <h1 className="text-white text-lg font-bold leading-normal">Trezury</h1>
            <p className="text-[#c6b795] text-sm font-normal leading-normal">Trading Dashboard</p>
          </div>
        </div>

        {/* Portfolio Overview */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#463c25]">
            <WalletIcon className="h-5 w-5 text-white" />
            <p className="text-white text-sm font-medium leading-normal">Portfolio Overview</p>
          </div>
          
          {/* Wallet Type Toggle */}
          <p className="text-[#c6b795] text-xs font-medium px-1 mb-1">Wallets</p>
          <div className="flex gap-0.5 bg-[#211d12] rounded-lg p-1">
            <button
              onClick={() => setWalletType('trading')}
              className={`flex-1 px-1 py-1.5 rounded text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                walletType === 'trading' 
                  ? 'bg-[#e6b951] text-black' 
                  : 'text-[#c6b795] hover:text-white'
              }`}
            >
              Trading
            </button>
            <button
              onClick={() => setWalletType('internal')}
              className={`flex-1 px-1 py-1.5 rounded text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                walletType === 'internal' 
                  ? 'bg-[#e6b951] text-black' 
                  : 'text-[#c6b795] hover:text-white'
              }`}
            >
              Internal
            </button>
            <button
              onClick={() => setWalletType('external')}
              className={`flex-1 px-1 py-1.5 rounded text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                walletType === 'external' 
                  ? 'bg-[#e6b951] text-black' 
                  : 'text-[#c6b795] hover:text-white'
              }`}
            >
              External
            </button>
          </div>

          {/* Wallet Info - Always show wallet type selector */}
          {walletType === 'trading' ? (
            tradingWallet.isReady && tradingWallet.address ? (
              <div className="bg-[#2a251a] rounded-lg p-2 border border-[#463c25] space-y-1.5 min-h-[140px]">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#c6b795] text-xs">Trading Wallet:</span>
                      <button
                        onClick={() => tradingWallet.address && copyAddress(tradingWallet.address)}
                        className="flex items-center gap-1 text-white text-xs hover:text-[#e6b951] transition-colors"
                      >
                        {tradingWallet.address?.slice(0, 6)}...{tradingWallet.address?.slice(-4)}
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={tradingWallet.type === 'external' ? 'default' : 'outline'} 
                             className="text-xs bg-[#e6b951]/20 text-[#e6b951] border-[#e6b951]/30">
                        <Shield className="h-3 w-3 mr-1" />
                        {tradingWallet.type === 'external' ? '🔗 External' : '🔒 Generated'} Wallet Active
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#c6b795] text-sm">Account Value:</span>
                      <span className="text-white font-semibold">
                        ${tradingWallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {accountInfo && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#c6b795] text-sm">Available:</span>
                        <span className="text-white font-semibold">
                          ${parseFloat(accountInfo.withdrawable || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  onClick={handleRefreshBalances}
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-[#c6b795] hover:text-white hover:bg-[#463c25] transition-colors duration-150 text-xs"
                  disabled={internalLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${internalLoading ? 'animate-spin' : ''}`} />
                  Refresh Balances
                </Button>

                {tradingWallet.type === 'external' && (
                  <Alert className="mt-2 bg-[#463c25]/30 border-[#e6b951]/30">
                    <Shield className="h-3 w-3 text-[#e6b951]" />
                    <AlertDescription className="text-xs text-[#c6b795]">
                      Trading with MetaMask - you'll sign each order in your wallet
                    </AlertDescription>
                  </Alert>
                )}

                {tradingWallet.balance === 0 && (
                  <Alert className="mt-2 bg-[#463c25]/30 border-[#e6b951]/30">
                    <AlertCircle className="h-4 w-4 text-[#e6b951]" />
                    <AlertDescription className="text-xs text-[#c6b795]">
                      Your trading wallet is ready! Click "Deposit" to fund it and start trading.
                    </AlertDescription>
                  </Alert>
                )}

                {tradingWallet.address ? (
                  <>
                    <Button 
                      onClick={() => setShowDepositModal(true)}
                      className="w-full h-7 bg-[#e6b951]/20 text-[#e6b951] hover:bg-[#e6b951]/30 font-bold transition-colors duration-150 text-xs"
                    >
                      Deposit
                    </Button>
                    <Button 
                      onClick={() => setShowWithdrawModal(true)}
                      variant="outline" 
                      className="w-full h-7 border-[#e6b951]/50 text-[#e6b951] hover:bg-[#e6b951]/10 font-bold transition-colors duration-150 text-xs"
                    >
                      Withdraw
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setShowWalletGenerator(true)}
                    className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
                  >
                    <WalletIcon className="h-4 w-4 mr-2" />
                    Generate Trading Wallet
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <Shield className="h-12 w-12 mx-auto mb-3 text-[#e6b951]/40" />
                  <p className="text-white text-sm font-semibold mb-1">No Trading Wallet</p>
                  <p className="text-[#c6b795] text-xs mb-4">
                    Choose how you want to trade on Hyperliquid
                  </p>
                  
                  <div className="space-y-2">
                    {/* Option 1: Generate Trading Wallet */}
                    <Button
                      onClick={() => setShowWalletGenerator(true)}
                      className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Generate Trading Wallet
                    </Button>
                    
                    {/* Option 2: Use External Wallet */}
                    <Button
                      onClick={handleConnectWallet}
                      variant="outline"
                      className="w-full border-[#e6b951]/50 text-[#e6b951] hover:bg-[#e6b951]/10 font-bold"
                      disabled={connecting}
                    >
                      <WalletIcon className="h-4 w-4 mr-2" />
                      {connecting ? 'Connecting...' : 'Use External Wallet (MetaMask)'}
                    </Button>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-[#463c25]">
                    <p className="text-[#c6b795] text-xs">
                      💡 <strong>Generated Wallet:</strong> Password-protected, stored securely<br/>
                      💡 <strong>External Wallet:</strong> Use your MetaMask wallet
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : walletType === 'internal' ? (
            internalAddress ? (
              <div className="bg-[#2a251a] rounded-lg p-2 border border-[#463c25] space-y-1.5 min-h-[140px]">
                <div className="space-y-2">
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
                  className="w-full h-7 text-[#c6b795] hover:text-white hover:bg-[#463c25] transition-colors duration-150 text-xs"
                  disabled={internalLoading}
                >
                  <RefreshCw className={`h-3 w-3 mr-1.5 ${internalLoading ? 'animate-spin' : ''}`} />
                  Refresh Balances
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <Shield className="h-12 w-12 mx-auto mb-3 text-[#e6b951]/40" />
                  <p className="text-white text-sm font-semibold mb-1">No Internal Wallet Found</p>
                  <p className="text-[#c6b795] text-xs mb-3">
                    Create your secure internal wallet
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
              <div className="bg-[#2a251a] rounded-lg p-2 border border-[#463c25] space-y-1.5 min-h-[140px]">
                <div className="space-y-2">
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

                {hyperliquidAddress && (
                  <>
                    <Button 
                      onClick={() => setShowDepositModal(true)}
                      className="w-full h-7 bg-[#e6b951]/20 text-[#e6b951] hover:bg-[#e6b951]/30 font-bold inline-flex items-center justify-center gap-1.5 leading-none transition-colors duration-150 text-xs"
                    >
                       <DollarSign className="h-3 w-3" />
                      Deposit
                    </Button>
                    <Button 
                      onClick={() => setShowWithdrawModal(true)}
                      variant="outline" 
                      className="w-full h-7 border-[#e6b951]/50 text-[#e6b951] hover:bg-[#e6b951]/10 font-bold inline-flex items-center justify-center gap-1.5 leading-none transition-colors duration-150 text-xs"
                    >
                      <DollarSign className="h-3 w-3" />
                      Withdraw
                    </Button>
                  </>
                )}
              </div>
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
                    className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold transition-all hover:scale-105"
                    disabled={connecting}
                  >
                    {connecting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <WalletIcon className="h-4 w-4 mr-2" />
                        Connect MetaMask
                      </>
                    )}
                  </Button>
                  
                  <div className="mt-3 p-2 bg-[#463c25]/30 rounded-lg">
                    <p className="text-[#c6b795] text-[10px] text-center">
                      Don't have MetaMask?{' '}
                      <a 
                        href="https://metamask.io/download/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#e6b951] hover:underline"
                      >
                        Download here
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Assets List */}
        <p className="text-[#c6b795] text-[10px] font-bold uppercase tracking-wider px-2 mb-1.5">
          {tradingMode === 'spot' ? 'Spot Assets' : 'Leverage Assets'}
        </p>
        <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
          {marketsLoading ? (
            <>
              <Skeleton className="h-8 rounded-lg bg-[#463c25]/30" />
              <Skeleton className="h-8 rounded-lg bg-[#463c25]/30" />
              <Skeleton className="h-8 rounded-lg bg-[#463c25]/30" />
            </>
          ) : (
            <>
              {tradingMode === 'leverage' && leverageAssets.map((asset) => (
                <button
                  key={asset.name}
                  onClick={() => setSelectedAsset(asset.name)}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg group transition-colors ${
                    selectedAsset === asset.name ? 'bg-[#463c25]' : 'hover:bg-[#463c25]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-white" />
                    <p className="text-white text-xs font-medium leading-normal">{asset.name}</p>
                  </div>
                </button>
              ))}
              {tradingMode === 'spot' && spotAssets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => setSelectedAsset(asset.symbol)}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg group transition-colors ${
                    selectedAsset === asset.symbol ? 'bg-[#463c25]' : 'hover:bg-[#463c25]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-white" />
                    <p className="text-white text-xs font-medium leading-normal">{asset.symbol}</p>
                  </div>
                  <span className={`text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
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
      <main className="flex-1 flex flex-col p-2 relative bg-[#211d12] overflow-hidden flex-shrink-0">
        {/* Top Stats */}
        <div className="flex gap-2 p-1.5 bg-[#2a251a]/50 backdrop-blur-sm rounded-lg border border-[#635636]/50 mb-2 ml-auto flex-shrink-0">
          {isCurrentWalletConnected && (
            <>
              <div className="flex flex-col items-center px-2.5 hover:bg-[#2a251a]/70 rounded transition-colors duration-150">
                <p className="text-[#c6b795] text-xs font-medium">Wallet</p>
                <p className="text-white text-sm font-bold capitalize">{walletType}</p>
              </div>
              <div className="flex flex-col items-center px-2.5 hover:bg-[#2a251a]/70 rounded transition-colors duration-150">
                <p className="text-[#c6b795] text-xs font-medium">P&L</p>
                <p className="text-green-400 text-sm font-bold">+$1.2K</p>
              </div>
              <div className="flex flex-col items-center px-2.5 hover:bg-[#2a251a]/70 rounded transition-colors duration-150">
                <p className="text-[#c6b795] text-xs font-medium">Funding</p>
                <p className="text-white text-sm font-bold">0.01%</p>
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
        </div>

        {/* Price Display */}
        {currentAsset && 'price' in currentAsset && (
          <div className="mb-2 flex-shrink-0">
            <div className="flex items-baseline gap-2">
              <p className="text-[#c6b795] text-xs font-medium">{selectedAsset}</p>
              <h2 className="text-white text-xl font-outfit font-light tracking-tight">
                {currentAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <Badge variant={('changePercent24h' in currentAsset ? currentAsset.changePercent24h : (currentAsset as any).change24h) > 0 ? "default" : "destructive"} className="text-xs">
                {('changePercent24h' in currentAsset ? currentAsset.changePercent24h : (currentAsset as any).change24h) > 0 ? '+' : ''}
                {typeof (('changePercent24h' in currentAsset 
                  ? currentAsset.changePercent24h 
                  : (currentAsset as any).change24h
                )) === 'number' 
                  ? (('changePercent24h' in currentAsset 
                    ? currentAsset.changePercent24h 
                    : (currentAsset as any).change24h
                  ) as number).toFixed(2)
                  : (('changePercent24h' in currentAsset 
                    ? currentAsset.changePercent24h 
                    : (currentAsset as any).change24h
                  ))
                }%
              </Badge>
            </div>
          </div>
        )}

        {/* Chart Controls */}
        <div className="flex items-center justify-between gap-1 mb-2 flex-shrink-0">
          <div className="flex gap-0">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map((interval, idx) => (
              <Button
                key={interval}
                size="sm"
                variant="ghost"
                onClick={() => setChartResolution(intervalToResolution[interval])}
                className={`h-6 px-2 text-[10px] transition-colors duration-150 ${
                  idx === 0 ? 'rounded-r-none' : idx === 5 ? 'rounded-l-none' : 'rounded-none'
                } ${chartResolution === intervalToResolution[interval] ? 'bg-[#463c25] text-white' : 'text-[#c6b795] hover:text-white hover:bg-[#463c25]'}`}
              >
                {interval}
              </Button>
            ))}
          </div>
          
          {/* Funding Rate Display */}
          {selectedAsset && (
            <FundingRateDisplay
              market={selectedAsset}
            />
          )}
        </div>

        {/* Health Banner */}
        <ConnectionHealthBanner 
          isConnected={wsHealth.isConnected}
          reconnectAttempts={wsHealth.reconnectAttempts}
          maxAttempts={wsHealth.maxAttempts}
        />

        {/* Chart Section - Fixed responsive height */}
        <div className="flex-1 min-h-[550px] rounded-lg overflow-hidden bg-[#1a1712] border border-[#463c25] mb-2">
          {selectedAsset ? (
            tradingMode === 'leverage' ? (
              <TradingViewChart
                key={`${selectedAsset}-${chartResolution}`}
                symbol={selectedAsset}
                candles={candles}
                resolution={chartResolution}
                onResolutionChange={setChartResolution}
                loading={candlesLoading}
                error={candlesError}
                onLoadMore={loadMoreHistory}
                isBackfilling={isLoadingMore}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-24 w-24 mx-auto mb-4 text-[#e6b951]/40" />
                  <h3 className="text-xl font-semibold text-[#e6b951] mb-2">Spot Trading Chart</h3>
                  <p className="text-[#c6b795] max-w-md">
                    Chart for {selectedAsset} will be integrated with spot market data.
                  </p>
                </div>
              </div>
            )
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

        {/* Open Positions Table - Compact */}
        {hyperliquidAddress && (
          <div className="h-[100px] flex-shrink-0 overflow-hidden">
            <OpenPositionsTable address={hyperliquidAddress} currentPrices={currentPrices} />
          </div>
        )}
      </main>

      {/* Right Sidebar - Order Panel */}
      <aside className="w-80 h-screen bg-[#2a251a] border-l border-[#463c25] p-3 overflow-hidden flex-shrink-0 flex flex-col">
        <h2 className="text-white text-lg font-bold mb-2 flex-shrink-0">Order Panel</h2>

        {/* Order Book - Optimized Height */}
        <div className="mb-2 flex-shrink-0 max-h-[104px] overflow-hidden">
          <OrderBook symbol={selectedAsset} />
        </div>

        <Tabs value={tradeMode} onValueChange={(v) => setTradeMode(v as 'buy' | 'sell' | 'positions')} className="mb-2 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-3 bg-[#211d12] p-0.5 h-9">
            <TabsTrigger 
              value="buy" 
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-[#c6b795] text-sm font-semibold rounded-sm transition-colors duration-150"
            >
              Buy
            </TabsTrigger>
            <TabsTrigger 
              value="sell" 
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-[#c6b795] text-sm font-semibold rounded-sm transition-colors duration-150"
            >
              Sell
            </TabsTrigger>
            <TabsTrigger 
              value="positions" 
              className="data-[state=active]:bg-[#e6b951] data-[state=active]:text-black text-[#c6b795] text-sm font-semibold rounded-sm transition-colors duration-150"
            >
              Positions
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tradeMode !== 'positions' ? (
          <>
            <div className="space-y-1.5 pr-1">
              {/* Order Type */}
              <div>
                <label className="text-[#c6b795] text-xs font-medium mb-1 block">Order Type</label>
                <Select value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                  <SelectTrigger className="bg-[#211d12] border-[#463c25] text-white h-8">
                    <SelectValue placeholder="Market Order" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#211d12] border-[#463c25]">
                    <SelectItem value="market" className="text-white text-sm">Market Order</SelectItem>
                    <SelectItem value="limit" className="text-white text-sm">Limit Order</SelectItem>
                    <SelectItem value="stop-limit" className="text-white text-sm">Stop Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Stop Price (for stop-limit orders) */}
              {orderType === 'stop-limit' && (
                <div>
                  <label className="text-[#c6b795] text-xs font-medium mb-1 block">Stop Price (USDT)</label>
                  <input
                    type="number"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 bg-[#211d12] border border-[#463c25] rounded-lg text-white text-sm focus:border-[#e6b951] focus:ring-1 focus:ring-[#e6b951]"
                  />
                </div>
              )}

              {/* Price */}
              <div>
                <label className="text-[#c6b795] text-xs font-medium mb-1 block">
                  {orderType === 'stop-limit' ? 'Limit Price (USDT)' : 'Price (USDT)'}
                </label>
                <input
                  type="text"
                  value={orderType === 'market' ? 'Market' : limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  disabled={orderType === 'market'}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-[#211d12] border border-[#463c25] rounded-lg text-white text-sm focus:border-[#e6b951] focus:ring-1 focus:ring-[#e6b951]"
                />
              </div>

              {/* Order Size */}
              <div>
                <label className="text-[#c6b795] text-xs font-medium mb-1 block">
                  Order Size ({selectedAsset?.split('-')[0] || 'BTC'})
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={orderSize}
                  onChange={(e) => setOrderSize(e.target.value)}
                  step={0.001}
                  min={0}
                  className="w-full px-2 py-1.5 bg-[#211d12] border border-[#463c25] rounded-lg text-white text-sm focus:border-[#e6b951] focus:ring-1 focus:ring-[#e6b951]"
                />
                {/* Percentage Buttons */}
                <div className="flex gap-1 mt-1.5">
                {['25%', '50%', '75%', '100%'].map((pct) => (
                  <Button
                    key={pct}
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-[10px] py-0.5 h-6 bg-[#211d12] text-[#c6b795] hover:bg-[#463c25] hover:text-white transition-colors duration-150"
                  >
                    {pct}
                  </Button>
                ))}
                </div>
              </div>

              {/* Leverage Section - Always Show with Message */}
              <div className="space-y-2.5 mt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#c6b795] text-xs font-medium">Leverage</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[#e6b951] text-sm font-bold">{leverage}x</span>
                    {selectedAsset && (
                      <span className="text-[#c6b795] text-[10px]">Max: {getMaxLeverage(selectedAsset)}x</span>
                    )}
                  </div>
                </div>
                
                {selectedAsset && leverageAssets.find(a => a.name === selectedSymbol) ? (
                  <>
                    {/* Quick Leverage Buttons */}
                    <div className="flex gap-1.5">
                      {['1x', '5x', '10x', '25x', '50x']
                        .filter(lvg => parseInt(lvg) <= getMaxLeverage(selectedAsset))
                        .map((lvg) => (
                        <Button
                          key={lvg}
                          size="sm"
                          variant={leverage === parseInt(lvg) ? "default" : "ghost"}
                          onClick={() => setLeverage(parseInt(lvg))}
                          className={leverage === parseInt(lvg) 
                            ? 'flex-1 text-xs py-0.5 h-6 bg-[#e6b951] text-black transition-colors duration-150' 
                            : 'flex-1 text-xs py-0.5 h-6 bg-[#211d12] text-[#c6b795] hover:bg-[#463c25] hover:text-white transition-colors duration-150'
                          }
                        >
                          {lvg}
                        </Button>
                      ))}
                    </div>

                    {/* Custom Leverage Slider */}
                    <div className="px-1 pt-1">
                      <Slider
                        value={[leverage]}
                        onValueChange={(value) => setLeverage(Math.min(value[0], getMaxLeverage(selectedAsset)))}
                        min={1}
                        max={getMaxLeverage(selectedAsset)}
                        step={1}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between mt-1.5 text-[10px] text-[#c6b795]/60">
                        <span>1x</span>
                        <span>{getMaxLeverage(selectedAsset)}x</span>
                      </div>
                    </div>

                    {/* Liquidation Price Estimate */}
                    {orderSize && currentAsset && 'price' in currentAsset && leverage > 1 && (
                      <div className="p-2 bg-[#211d12] rounded border border-[#463c25] space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#c6b795]">Est. Liquidation Price:</span>
                          <span className="text-white font-mono">
                            ${(() => {
                              const entryPrice = orderType === 'limit' ? parseFloat(limitPrice) : currentAsset.price;
                              const maintenanceMargin = 0.025;
                              const liqPrice = tradeMode === 'buy'
                                ? entryPrice * (1 - (1 / leverage) + maintenanceMargin)
                                : entryPrice * (1 + (1 / leverage) - maintenanceMargin);
                              return liqPrice.toFixed(2);
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#c6b795]">Distance:</span>
                          <span className={`font-semibold ${
                            leverage > 10 ? 'text-red-400' : leverage > 5 ? 'text-yellow-400' : 'text-green-400'
                          }`}>
                            {(() => {
                              const entryPrice = orderType === 'limit' ? parseFloat(limitPrice) : currentAsset.price;
                              const maintenanceMargin = 0.025;
                              const liqPrice = tradeMode === 'buy'
                                ? entryPrice * (1 - (1 / leverage) + maintenanceMargin)
                                : entryPrice * (1 + (1 / leverage) - maintenanceMargin);
                              const distance = Math.abs((entryPrice - liqPrice) / entryPrice * 100);
                              return `${distance.toFixed(1)}%`;
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    {leverage > 10 && (
                      <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                        <p className="text-yellow-400 text-[10px] flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          High leverage increases liquidation risk
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3 bg-[#211d12] rounded-lg border border-[#463c25]/50">
                    <p className="text-[#c6b795] text-xs text-center">
                      Leverage not available for {selectedAsset?.split('-')[0] || 'this asset'}. 
                      <br />
                      Switch to BTC, ETH, or SOL for leverage trading.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Total, Available and Confirm Button - Sticky at Bottom */}
            <div className="flex-shrink-0 space-y-1.5 pt-2.5 mt-auto border-t border-[#463c25] bg-[#2a251a]">
              <div className="space-y-1">
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
              <div>
                {isCurrentWalletConnected ? (
                  <>
                    {!assetMapperReady && (
                      <div className="mb-2 p-2 bg-[#463c25]/30 rounded border border-[#e6b951]/30">
                        <p className="text-[#e6b951] text-xs text-center flex items-center justify-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Loading market data...
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={handlePlaceOrder}
                      className={`w-full h-10 font-bold text-sm transition-colors duration-150 ${
                        tradeMode === 'buy' 
                          ? 'bg-[#e6b951] hover:bg-[#d4a840] text-black' 
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                      disabled={!selectedAsset || !orderSize || orderLoading || !assetMapperReady}
                    >
                      {orderLoading ? 'Placing Order...' : !assetMapperReady ? 'Loading...' : `Confirm ${tradeMode === 'buy' ? 'Buy' : 'Sell'}`}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleConnectWallet}
                    className="w-full h-10 font-bold bg-[#e6b951] hover:bg-[#d4a840] text-black text-sm transition-colors duration-150"
                    disabled={connecting}
                  >
                    <WalletIcon className="h-4 w-4 mr-2" />
                    {connecting ? 'Connecting...' : 'Connect Wallet'}
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
            {hyperliquidAddress ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white text-sm font-semibold">Open Positions</h3>
                </div>
                <PositionManager address={hyperliquidAddress} currentPrices={currentPrices} userId={user?.id} />
                <OrderHistory address={hyperliquidAddress} />
              </>
            ) : (
              <div className="text-center py-12">
                <TrendingUpDown className="h-16 w-16 mx-auto mb-4 text-[#e6b951]/40" />
                <h3 className="text-lg font-semibold text-white mb-2">No Wallet Connected</h3>
                <p className="text-[#c6b795] text-sm mb-4">
                  Connect your wallet to start trading on Hyperliquid.
                </p>
                <Button
                  onClick={handleConnectWallet}
                  className="bg-[#e6b951] hover:bg-[#d4a840] text-black"
                  disabled={connecting}
                >
                  <WalletIcon className="h-4 w-4 mr-2" />
                  {connecting ? 'Connecting...' : 'Connect Wallet'}
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

      {/* Password Unlock Dialog */}
      <PasswordUnlockDialog
        open={showPasswordDialog}
        onUnlock={handlePasswordUnlock}
        onCancel={() => setShowPasswordDialog(false)}
      />

      {/* Wallet Generator Modal */}
      <Dialog open={showWalletGenerator} onOpenChange={setShowWalletGenerator}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <HyperliquidWalletGenerator
            userId={user?.id || ''}
            onWalletCreated={handleWalletGenerated}
          />
        </DialogContent>
      </Dialog>

      {/* Deposit Modal */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DepositHyperliquidBridge
            hyperliquidAddress={hyperliquidAddress || ''}
            onSuccess={() => {
              setShowDepositModal(false);
              refreshAccount();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        tradingWalletAddress={hyperliquidAddress || ''}
        availableBalance={accountInfo ? parseFloat(accountInfo.withdrawable) : 0}
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
