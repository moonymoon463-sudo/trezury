import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { use01Markets } from '@/hooks/use01Markets';
import AurumLogo from '@/components/AurumLogo';
import { O1MarketList } from '@/components/trading/O1MarketList';
import { O1OrderEntry } from '@/components/trading/O1OrderEntry';
import { O1PositionsTable } from '@/components/trading/O1PositionsTable';
import { O1OrderHistory } from '@/components/trading/O1OrderHistory';

const O1TradingDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { markets, loading: marketsLoading, error: marketsError, refetch: refetchMarkets } = use01Markets();
  
  const [selectedMarket, setSelectedMarket] = useState('SOL-PERP');
  const [activeTab, setActiveTab] = useState<'trade' | 'positions' | 'history'>('trade');
  const [refreshing, setRefreshing] = useState(false);

  // Auto-select first market when data loads
  useEffect(() => {
    if (markets.length > 0 && !selectedMarket) {
      setSelectedMarket(markets[0].symbol);
    }
  }, [markets, selectedMarket]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchMarkets();
    setRefreshing(false);
    toast({
      title: "Markets Refreshed",
      description: "Latest market data loaded",
    });
  };

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

  const currentMarket = markets.find(m => m.symbol === selectedMarket);
  const isPriceUp = currentMarket ? currentMarket.change24h >= 0 : true;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Sidebar */}
      <aside className="flex flex-col w-72 bg-card border-r border-border p-4 overflow-hidden flex-shrink-0">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 mb-6">
          <AurumLogo className="h-12 w-12" />
          <div className="flex flex-col">
            <h1 className="text-foreground text-lg font-bold">Trezury</h1>
            <p className="text-muted-foreground text-sm">01 Protocol Trading</p>
          </div>
        </div>

        {/* Markets Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground text-sm font-semibold">Markets</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Market List */}
        <O1MarketList
          markets={markets}
          selectedMarket={selectedMarket}
          onSelectMarket={setSelectedMarket}
          loading={marketsLoading}
          error={marketsError}
        />

        {/* Bottom Info */}
        <div className="mt-auto pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-status-success animate-pulse" />
            <span>Solana Mainnet</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Connection Health Banner - removed for 01 Protocol */}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-foreground text-2xl font-bold">{selectedMarket}</h2>
              {currentMarket && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-foreground text-xl font-semibold">
                    ${currentMarket.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <Badge variant={isPriceUp ? 'default' : 'destructive'} className="gap-1">
                    {isPriceUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPriceUp ? '+' : ''}{currentMarket.change24h.toFixed(2)}%
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Main Trading Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chart Area (Placeholder for now) */}
          <div className="flex-1 p-4">
            <Card className="h-full bg-card/50 border-border/40 flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground text-sm mb-2">Chart Coming Soon</p>
                <p className="text-muted-foreground/60 text-xs">Real-time price chart will be integrated here</p>
              </div>
            </Card>
          </div>

          {/* Right Panel - Order Entry & Positions */}
          <div className="w-96 flex flex-col border-l border-border overflow-hidden">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-card/50 border-b border-border rounded-none">
                <TabsTrigger value="trade">Trade</TabsTrigger>
                <TabsTrigger value="positions">Positions</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'trade' && (
                <O1OrderEntry 
                  market={selectedMarket}
                  currentPrice={currentMarket?.markPrice || 0}
                />
              )}
              {activeTab === 'positions' && (
                <O1PositionsTable />
              )}
              {activeTab === 'history' && (
                <O1OrderHistory />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default O1TradingDashboard;
