import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useDydxMarkets } from '@/hooks/useDydxMarkets';
import { useDydxOrderbook } from '@/hooks/useDydxOrderbook';
import { useDydxPositions } from '@/hooks/useDydxPositions';
import { useDydxCandles } from '@/hooks/useDydxCandles';
import { ArrowLeft, Wallet as WalletIcon, TrendingUp, TrendingDown, BarChart3, Activity, Settings, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import TradingViewChart from '@/components/trading/TradingViewChart';
import AurumLogo from '@/components/AurumLogo';

const TradingDashboard = () => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>('BTC-USD');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-limit'>('market');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [leverage, setLeverage] = useState(1);
  const [chartResolution, setChartResolution] = useState<string>('1HOUR');
  const { wallet, connectWallet, disconnectWallet, connecting } = useWalletConnection();
  const { toast } = useToast();

  // Real dYdX market data
  const { markets, loading: marketsLoading } = useDydxMarkets();
  const { orderbook, loading: orderbookLoading } = useDydxOrderbook(selectedAsset);
  const { positions } = useDydxPositions(wallet.address);
  const { candles, loading: candlesLoading } = useDydxCandles(selectedAsset, chartResolution, 200);

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

  const handleDisconnect = () => {
    disconnectWallet();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-foreground">
      {/* Header */}
      <header className="border-b border-aurum/20 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="relative flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-aurum hover:text-aurum-glow">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>

          {/* Centered Logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <AurumLogo className="h-32 w-32" />
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center gap-4">
            {wallet.isConnected ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-aurum text-aurum px-4 py-2">
                  <Activity className="h-3 w-3 mr-2" />
                  {formatAddress(wallet.address!)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowWalletModal(true)}
                className="bg-gradient-to-r from-aurum to-aurum-glow text-black font-semibold hover:from-aurum-glow hover:to-aurum"
              >
                <WalletIcon className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Trading Interface */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Asset Selector */}
        <div className="w-80 border-r border-aurum/20 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-aurum mb-4">Assets</h2>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Leverage Trading (5x)</h3>
              {marketsLoading ? (
                <>
                  <Skeleton className="h-24 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                </>
              ) : (
                leverageAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    onClick={() => setSelectedAsset(asset.symbol)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedAsset === asset.symbol
                        ? 'bg-gradient-to-r from-aurum/20 to-aurum-glow/20 border border-aurum/40'
                        : 'bg-zinc-900/50 border border-zinc-800 hover:border-aurum/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{asset.symbol}</span>
                      <Badge variant={asset.changePercent24h > 0 ? "default" : "destructive"} className="text-xs">
                        {asset.changePercent24h > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {Math.abs(asset.changePercent24h).toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{asset.name}</div>
                    <div className="text-lg font-semibold text-aurum mt-1">
                      ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </button>
                ))
              )}

              <Separator className="my-4 bg-aurum/20" />

              <h3 className="text-sm font-medium text-muted-foreground mb-2">Spot Trading</h3>
              {spotAssets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => setSelectedAsset(asset.symbol)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedAsset === asset.symbol
                      ? 'bg-gradient-to-r from-aurum/20 to-aurum-glow/20 border border-aurum/40'
                      : 'bg-zinc-900/50 border border-zinc-800 hover:border-aurum/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{asset.symbol}</span>
                    <Badge variant={asset.change24h > 0 ? "default" : "destructive"} className="text-xs">
                      {asset.change24h > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {Math.abs(asset.change24h)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{asset.name}</div>
                  <div className="text-lg font-semibold text-aurum mt-1">
                    ${asset.price.toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center - Chart Area */}
        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b border-aurum/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-aurum">{selectedAsset || 'Select Asset'}</h2>
                <p className="text-muted-foreground">{currentAsset ? (currentAsset as any).name : 'Choose an asset to trade'}</p>
              </div>
              {currentAsset && 'price' in currentAsset && (
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    ${currentAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`flex items-center justify-end gap-1 ${
                    ('changePercent24h' in currentAsset ? currentAsset.changePercent24h : (currentAsset as any).change24h) > 0 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {('changePercent24h' in currentAsset ? currentAsset.changePercent24h : (currentAsset as any).change24h) > 0 
                      ? <TrendingUp className="h-4 w-4" /> 
                      : <TrendingDown className="h-4 w-4" />
                    }
                    <span>
                      {('changePercent24h' in currentAsset 
                        ? currentAsset.changePercent24h.toFixed(2) 
                        : (currentAsset as any).change24h
                      )}% (24h)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Orderbook Preview */}
          {selectedAsset && leverageAssets.find(a => a.symbol === selectedAsset) && (
            <div className="p-6 border-b border-aurum/20 bg-black/20">
              <h3 className="text-sm font-semibold text-aurum mb-3">Live Order Book</h3>
              {orderbookLoading ? (
                <Skeleton className="h-40 rounded-lg" />
              ) : orderbook ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-semibold">BIDS</div>
                    <div className="space-y-1">
                      {orderbook.bids.slice(0, 5).map((bid, i) => (
                        <div key={i} className="flex justify-between py-1 px-2 rounded bg-green-500/5">
                          <span className="text-green-500 font-mono">${parseFloat(bid.price).toLocaleString()}</span>
                          <span className="text-muted-foreground font-mono">{parseFloat(bid.size).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-semibold">ASKS</div>
                    <div className="space-y-1">
                      {orderbook.asks.slice(0, 5).map((ask, i) => (
                        <div key={i} className="flex justify-between py-1 px-2 rounded bg-red-500/5">
                          <span className="text-red-500 font-mono">${parseFloat(ask.price).toLocaleString()}</span>
                          <span className="text-muted-foreground font-mono">{parseFloat(ask.size).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No orderbook data available</p>
              )}
            </div>
          )}

          {/* Chart Section with TradingView */}
          <div className="flex-1 p-4 bg-gradient-to-br from-zinc-950 to-black overflow-hidden flex flex-col min-h-0">
            {selectedAsset && leverageAssets.find(a => a.symbol === selectedAsset) ? (
              <TradingViewChart
                symbol={selectedAsset}
                candles={candles}
                resolution={chartResolution}
                onResolutionChange={setChartResolution}
              />
            ) : selectedAsset ? (
              <Card className="flex-1 bg-black/60 border-aurum/20">
                <CardContent className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="h-24 w-24 mx-auto mb-4 text-aurum/40" />
                    <h3 className="text-xl font-semibold text-aurum mb-2">Spot Trading Chart</h3>
                    <p className="text-muted-foreground max-w-md">
                      Chart for {selectedAsset} will be integrated with spot market data.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex-1 bg-black/60 border-aurum/20">
                <CardContent className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="h-24 w-24 mx-auto mb-4 text-aurum/40" />
                    <h3 className="text-xl font-semibold text-aurum mb-2">Select an Asset</h3>
                    <p className="text-muted-foreground max-w-md">
                      Choose a trading pair from the left sidebar to view its chart.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Sidebar - Order Panel */}
        <div className="w-96 border-l border-aurum/20 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="p-4">
            <Tabs value={tradeMode} onValueChange={(v) => setTradeMode(v as 'buy' | 'sell')}>
              <TabsList className="grid w-full grid-cols-2 bg-zinc-900">
                <TabsTrigger value="buy" className="data-[state=active]:bg-green-600">Buy</TabsTrigger>
                <TabsTrigger value="sell" className="data-[state=active]:bg-red-600">Sell</TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-4">
                {/* Order Type Selection */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Order Type</label>
                  <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
                    <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
                      <TabsTrigger value="market" className="text-xs">Market</TabsTrigger>
                      <TabsTrigger value="limit" className="text-xs">Limit</TabsTrigger>
                      <TabsTrigger value="stop-limit" className="text-xs">Stop</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Leverage Slider (only for leverage assets) */}
                {selectedAsset && leverageAssets.find(a => a.symbol === selectedAsset) && (
                  <Card className="bg-zinc-900/50 border-aurum/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>Leverage</span>
                        <Badge className="bg-aurum text-black">{leverage}x</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={leverage}
                        onChange={(e) => setLeverage(Number(e.target.value))}
                        className="w-full accent-aurum"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>1x</span>
                        <span>5x</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Amount Input */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full px-4 py-3 bg-zinc-900 border border-aurum/20 rounded-lg focus:border-aurum focus:ring-1 focus:ring-aurum"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-aurum font-semibold">
                      {selectedAsset?.split('-')[0] || 'USD'}
                    </span>
                  </div>
                </div>

                {/* Price Input (for limit orders) */}
                {orderType !== 'market' && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Price</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full px-4 py-3 bg-zinc-900 border border-aurum/20 rounded-lg focus:border-aurum focus:ring-1 focus:ring-aurum"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        USD
                      </span>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <Card className="bg-zinc-900/50 border-aurum/20">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold">$0.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="font-semibold">$0.00</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Button */}
                <Button
                  disabled={!wallet.isConnected}
                  className={`w-full py-6 text-lg font-semibold ${
                    tradeMode === 'buy'
                      ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600'
                      : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600'
                  }`}
                >
                  {!wallet.isConnected ? 'Connect Wallet First' : `${tradeMode === 'buy' ? 'Buy' : 'Sell'} ${selectedAsset?.split('-')[0] || 'Asset'}`}
                </Button>
              </div>
            </Tabs>

            {/* Portfolio Section */}
            <Separator className="my-6 bg-aurum/20" />
            <Card className="bg-zinc-900/50 border-aurum/20">
              <CardHeader>
                <CardTitle className="text-sm text-aurum">Open Positions</CardTitle>
              </CardHeader>
              <CardContent>
                {!wallet.isConnected ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Connect wallet to view positions
                  </p>
                ) : positions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No open positions
                  </p>
                ) : (
                  <div className="space-y-3">
                    {positions.map((pos, i) => (
                      <div key={i} className="p-3 border border-aurum/20 rounded-lg bg-black/40">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-aurum">{pos.market}</div>
                            <div className={`text-xs ${pos.side === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>
                              {pos.side} {pos.size}
                            </div>
                          </div>
                          <div className={`text-sm font-semibold ${pos.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Entry: ${pos.entryPrice.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-aurum/20 bg-black/80 py-4 px-6">
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link to="/support" className="hover:text-aurum transition-colors">Docs</Link>
          <Link to="/support" className="hover:text-aurum transition-colors">Support</Link>
          <Link to="/support" className="hover:text-aurum transition-colors">Learn</Link>
          <span className="text-destructive font-semibold">Risk Disclaimer</span>
        </div>
      </footer>

      {/* Wallet Connection Modal */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="bg-zinc-950 border-aurum/20">
          <DialogHeader>
            <DialogTitle className="text-2xl text-aurum">Connect Your Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleConnectWallet}
              disabled={connecting}
              className="w-full py-6 bg-gradient-to-r from-aurum to-aurum-glow text-black font-semibold hover:from-aurum-glow hover:to-aurum justify-start text-lg"
            >
              <WalletIcon className="h-6 w-6 mr-3" />
              {connecting ? 'Connecting...' : 'MetaMask'}
            </Button>
            <Button
              disabled
              variant="outline"
              className="w-full py-6 border-aurum/20 text-muted-foreground justify-start text-lg opacity-50"
            >
              <WalletIcon className="h-6 w-6 mr-3" />
              WalletConnect (Coming Soon)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradingDashboard;
