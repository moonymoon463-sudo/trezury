import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useDydxMarkets } from '@/hooks/useDydxMarkets';
import { useDydxCandles } from '@/hooks/useDydxCandles';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, BarChart3, Settings, DollarSign, Zap, TrendingUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TradingViewChart from '@/components/trading/TradingViewChart';
import AurumLogo from '@/components/AurumLogo';

const TradingDashboard = () => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>('BTC-USD');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-limit'>('market');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | 'positions'>('buy');
  const [leverage, setLeverage] = useState(1);
  const [chartResolution, setChartResolution] = useState<string>('1HOUR');
  const { wallet, connectWallet } = useWalletConnection();
  const { toast } = useToast();

  // Real dYdX market data
  const { markets, loading: marketsLoading } = useDydxMarkets();
  const { candles } = useDydxCandles(selectedAsset, chartResolution, 200);

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
          <div className="pl-6 text-sm space-y-1">
            <div className="flex justify-between items-center text-white">
              <span>Balance:</span>
              <span className="font-semibold">$1,234,567.89</span>
            </div>
            <div className="flex justify-between items-center text-[#c6b795]">
              <span>Open Trades:</span>
              <span>5</span>
            </div>
          </div>
          <Button className="w-full bg-[#e6b951]/20 text-[#e6b951] hover:bg-[#e6b951]/30 font-bold">
            Deposit
          </Button>
          <Button variant="outline" className="w-full border-[#e6b951]/50 text-[#e6b951] hover:bg-[#e6b951]/10 font-bold">
            Withdraw
          </Button>
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
          {wallet.isConnected && (
            <>
              <div className="flex flex-col items-center px-2">
                <p className="text-[#c6b795] text-xs font-medium">Live P&L</p>
                <p className="text-green-400 text-base font-bold">+$1,234.56</p>
              </div>
              <div className="flex flex-col items-center px-2">
                <p className="text-[#c6b795] text-xs font-medium">Funding Rate</p>
                <p className="text-white text-base font-bold">0.01%</p>
              </div>
              <div className="flex flex-col items-center px-2">
                <p className="text-[#c6b795] text-xs font-medium">Sentiment</p>
                <p className="text-white text-base font-bold">Bullish</p>
              </div>
            </>
          )}
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex border-b border-[#463c25] gap-8 mb-6">
          <button className="flex flex-col items-center justify-center border-b-[3px] border-b-[#e6b951] text-white pb-[13px] pt-2">
            <p className="text-sm font-bold leading-normal tracking-[0.015em]">Spot</p>
          </button>
          <button className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-[#c6b795] pb-[13px] pt-2 hover:text-white">
            <p className="text-sm font-bold leading-normal tracking-[0.015em]">Leverage</p>
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
          <Button size="sm" variant="ghost" className="text-[#c6b795] hover:text-white hover:bg-[#463c25]/50 ml-4">
            <Zap className="h-4 w-4 mr-2" />
            Indicators
          </Button>
          <Button size="sm" variant="ghost" className="text-[#c6b795] hover:text-white hover:bg-[#463c25]/50">
            Vol RSI MACD
          </Button>
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

        {/* AI Insights Section */}
        <Card className="bg-[#2a251a] border-[#463c25]">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-semibold">AI Insights (WEPS Mode)</h3>
              <Badge className="bg-[#e6b951]/20 text-[#e6b951]">
                <TrendingUpDown className="h-3 w-3 mr-1" />
                Live Predictions
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1a1712] rounded-lg p-4 border border-[#463c25]">
                <div className="h-32 flex items-center justify-center">
                  <svg viewBox="0 0 200 60" className="w-full h-full">
                    <path
                      d="M 0,30 Q 20,10 40,30 T 80,30 Q 100,10 120,30 T 160,30 Q 180,50 200,30"
                      fill="none"
                      stroke="#e6b951"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="bg-[#1a1712] rounded-lg p-4 border border-[#463c25]">
                <h4 className="text-white font-semibold mb-2">Contextual Insights</h4>
                <p className="text-[#c6b795] text-sm leading-relaxed">
                  "Market rhythm suggests energy buildup — possible BTC long in 12h window."
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>

      {/* Right Sidebar - Order Panel */}
      <aside className="w-96 bg-[#2a251a] border-l border-[#463c25] p-4 overflow-y-auto">
        <h2 className="text-white text-xl font-bold mb-4">Order Panel</h2>

        <Tabs value={tradeMode} onValueChange={(v) => setTradeMode(v as 'buy' | 'sell' | 'positions')} className="mb-4">
          <TabsList className="grid w-full grid-cols-3 bg-[#211d12]">
            <TabsTrigger value="buy" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Buy</TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Sell</TabsTrigger>
            <TabsTrigger value="positions" className="data-[state=active]:bg-[#e6b951] data-[state=active]:text-black">Positions</TabsTrigger>
          </TabsList>
        </Tabs>

        {tradeMode !== 'positions' ? (
          <div className="space-y-4">
            {/* Order Type */}
            <div>
              <label className="text-[#c6b795] text-sm font-medium mb-2 block">Order Type</label>
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
              <label className="text-[#c6b795] text-sm font-medium mb-2 block">Price (USDT)</label>
              <input
                type="text"
                value="Market"
                disabled={orderType === 'market'}
                className="w-full px-4 py-3 bg-[#211d12] border border-[#463c25] rounded-lg text-white"
              />
            </div>

            {/* Order Size */}
            <div>
              <label className="text-[#c6b795] text-sm font-medium mb-2 block">Order Size ({selectedAsset?.split('-')[0] || 'BTC'})</label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full px-4 py-3 bg-[#211d12] border border-[#463c25] rounded-lg text-white focus:border-[#e6b951] focus:ring-1 focus:ring-[#e6b951]"
              />
              {/* Percentage Buttons */}
              <div className="flex gap-2 mt-2">
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
                className="w-full mt-3 accent-[#e6b951]"
              />
            </div>

            {/* Leverage */}
            {selectedAsset && leverageAssets.find(a => a.symbol === selectedAsset) && (
              <div>
                <label className="text-[#c6b795] text-sm font-medium mb-2 block">Leverage</label>
                <div className="flex gap-2 mb-2">
                  {['1x', '25x', '50x', '75x', '100x'].map((lvg) => (
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
                  max="100"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full accent-[#e6b951]"
                />
              </div>
            )}

            {/* Total and Available */}
            <div className="space-y-2 pt-4 border-t border-[#463c25]">
              <div className="flex justify-between text-sm">
                <span className="text-[#c6b795]">Total:</span>
                <span className="text-white font-semibold">1,313.57 USDT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#c6b795]">Available:</span>
                <span className="text-white font-semibold">1,234,567.89 USDT</span>
              </div>
            </div>

            {/* Confirm Button */}
            {wallet.isConnected ? (
              <Button
                className={`w-full h-12 font-bold text-lg ${
                  tradeMode === 'buy' 
                    ? 'bg-[#e6b951] hover:bg-[#d4a840] text-black' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                disabled={!selectedAsset}
              >
                Confirm {tradeMode === 'buy' ? 'Buy' : 'Sell'}
              </Button>
            ) : (
              <Button
                onClick={handleConnectWallet}
                className="w-full h-12 font-bold bg-[#e6b951] hover:bg-[#d4a840] text-black text-lg"
              >
                <WalletIcon className="h-5 w-5 mr-2" />
                Connect Wallet
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-12">
              <TrendingUpDown className="h-16 w-16 mx-auto mb-4 text-[#e6b951]/40" />
              <h3 className="text-lg font-semibold text-white mb-2">No Open Positions</h3>
              <p className="text-[#c6b795] text-sm">
                Your open positions will appear here.
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default TradingDashboard;
