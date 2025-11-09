import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShoppingCart, DollarSign, ArrowRightLeft, Send, Download, Wallet, AlertCircle } from "lucide-react";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useSecureWallet } from "@/hooks/useSecureWallet";
import { usePortfolioMonitoring } from "@/hooks/usePortfolioMonitoring";
import GoldPriceChart from "@/components/GoldPriceChart";
import AppLayout from "@/components/AppLayout";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AssetAllocationChart } from "@/components/portfolio/AssetAllocationChart";
import { AirdropEligibilityCard } from "@/components/AirdropEligibilityCard";
import { WormholeRedemptionAlert } from "@/components/WormholeRedemptionAlert";


const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading, refreshPrice } = useGoldPrice();
  const { getBalance, loading: balanceLoading, refreshBalances } = useWalletBalance();
  const { walletAddress, getWalletAddress } = useSecureWallet();
  const { portfolioAssets, portfolioSummary, loading: portfolioLoading, refreshData } = usePortfolioMonitoring();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  useEffect(() => {
    const checkWallet = async () => {
      const address = await getWalletAddress();
      console.info('[Index] Wallet check:', address ? 'exists' : 'not found');
      setHasWallet(!!address);
    };
    if (user) {
      checkWallet();
    }
  }, [user, getWalletAddress]);

  // Use portfolio summary for total value (includes all assets: ETH, USDC, XAUT, BTC, TRZRY)
  const totalPortfolioValue = portfolioSummary?.totalValue || 0;

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshPrice(),
        refreshBalances(),
        refreshData()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AppLayout
      headerProps={{
        showRefreshButton: true,
        onRefresh: handleRefresh,
        isRefreshing: isRefreshing,
        showSettingsButton: true
      }}
      showBottomNavOnAllScreens={true}
      className="flex flex-col flex-1 min-h-0"
    >
      
      <div className="flex-1 min-h-0 overflow-y-auto px-1 sm:px-2 md:px-4 space-y-2 sm:space-y-3">
        {/* Wallet Creation Banner */}
        {hasWallet === false && (
          <Card className="bg-accent/50 border-primary/50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground mb-1">
                  Create Your Secure Wallet
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Set up your secure wallet to start receiving deposits and managing your assets.
                </p>
                <Button 
                  size="sm"
                  onClick={() => navigate("/settings")}
                  className="text-xs bg-primary text-black hover:bg-primary/90"
                >
                  Create Wallet Now
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Wormhole Redemption Alert */}
        <WormholeRedemptionAlert />

        {/* Gold Price Section */}
        <div className="bg-surface-elevated rounded-xl p-3 flex-shrink-0">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-foreground text-base font-bold">Gold Price</h3>
            {priceLoading ? (
              <div className="animate-pulse">
                <div className="h-4 w-16 bg-gray-600 rounded"></div>
              </div>
            ) : goldPrice && (
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp size={14} />
                <span className="text-xs font-medium">
                  {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-foreground text-lg font-bold">
                {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_oz.toFixed(2)}` : "N/A"}
              </p>
              <p className="text-muted-foreground text-xs">USD/oz</p>
            </div>
            <div className="text-right">
              <p className="text-foreground text-sm font-semibold">
                {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_gram.toFixed(2)}` : "N/A"}
              </p>
              <p className="text-muted-foreground text-xs">USD/g</p>
            </div>
          </div>
        </div>

        {/* Action Buttons - 2x3 Grid */}
        <div className="grid grid-cols-2 gap-2 flex-shrink-0">
          <Button 
            className="bg-primary text-black font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90"
            onClick={() => navigate("/buy-sell-hub")}
          >
            <ShoppingCart size={14} />
            Buy Gold
          </Button>
          <Button 
            className="bg-card text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-black transition-all duration-200"
            onClick={() => navigate("/sell-gold")}
          >
            <DollarSign size={14} />
            Sell/Cash Out
          </Button>
          <Button 
            className="bg-card text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-black transition-all duration-200"
            onClick={() => navigate("/swap")}
          >
            <ArrowRightLeft size={14} />
            Swap
          </Button>
          <Button 
            className="bg-card text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-black transition-all duration-200"
            onClick={() => navigate("/trzry-hub")}
          >
            <TrendingUp size={14} />
            Buy Trzry
          </Button>
          <Button 
            className="bg-card text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-black transition-all duration-200"
            onClick={() => navigate("/send")}
          >
            <Send size={14} />
            Send
          </Button>
          <Button 
            className="bg-card text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-black transition-all duration-200"
            onClick={() => navigate("/receive")}
          >
            <Download size={14} />
            Receive
          </Button>
        </div>

        {/* Your Assets with Allocation Chart */}
        <div className="bg-surface-elevated rounded-xl p-3 flex-shrink-0">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-foreground text-base font-bold">Your Assets</h3>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-foreground text-lg font-bold">
                ${balanceLoading ? "..." : totalPortfolioValue.toFixed(2)}
              </p>
            </div>
          </div>
          
          {/* Asset Allocation Chart */}
          <div className="bg-background/50 rounded-lg p-2">
            <AssetAllocationChart 
              assets={portfolioAssets}
              loading={portfolioLoading || balanceLoading}
            />
          </div>
          
          {/* Airdrop Eligibility */}
          <div className="mt-3">
            <AirdropEligibilityCard />
          </div>
        </div>

        {/* Gold Price Chart */}
        <div className="flex-1 min-h-0">
          <GoldPriceChart />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
