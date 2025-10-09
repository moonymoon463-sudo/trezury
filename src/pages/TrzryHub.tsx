import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useTrzryReserves } from "@/hooks/useTrzryReserves";
import { TrendingUp, Shield, BarChart3, ArrowRight, Coins } from "lucide-react";
import TrzryReserveChart from "@/components/TrzryReserveChart";
import { AirdropEligibilityCard } from "@/components/AirdropEligibilityCard";
import { ReferralDashboard } from "@/components/ReferralDashboard";

const TrzryHub = () => {
  const navigate = useNavigate();
  const { getBalance, loading: balanceLoading } = useWalletBalance();
  const { reserveValue, totalXautBalance, growthPercentage, loading: reserveLoading } = useTrzryReserves();
  const [activeTab, setActiveTab] = useState("overview");

  const trzryBalance = getBalance('TRZRY');
  const trzryValue = trzryBalance * 1.1; // Approximate value, replace with actual pricing logic

  return (
    <AppLayout
      headerProps={{
        title: "TRZRY",
        showBackButton: true,
        backPath: "/",
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 min-h-0 px-1 sm:px-2 md:px-4 pb-4 mobile-safe-bottom overflow-visible">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="buy">Buy TRZRY</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            {/* Your TRZRY Balance */}
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Your Balance</p>
                    <p className="text-lg font-bold text-foreground">
                      {balanceLoading ? "..." : trzryBalance.toFixed(4)} TRZRY
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Value</p>
                  <p className="text-lg font-semibold text-primary">
                    ${trzryValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Reserve Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <div className="flex items-start gap-2 mb-1">
                  <Shield className="w-4 h-4 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Reserve Value</p>
                    <p className="text-base font-bold text-foreground truncate">
                      {reserveLoading ? "..." : `$${(reserveValue || 0).toLocaleString()}`}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-start gap-2 mb-1">
                  <Coins className="w-4 h-4 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Gold Backing</p>
                    <p className="text-base font-bold text-foreground truncate">
                      {reserveLoading ? "..." : `${(totalXautBalance || 0).toFixed(2)} oz`}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-3 col-span-2">
                <div className="flex items-start gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">7-Day Growth</p>
                    <p className="text-base font-bold text-primary">
                      {reserveLoading ? "..." : `+${(growthPercentage || 0).toFixed(2)}%`}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Key Features */}
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Why TRZRY?
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Gold-Backed Security:</span> Every TRZRY token is backed by physical gold reserves
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Growing Reserves:</span> Our treasury grows through platform fees and strategic investments
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Full Transparency:</span> Track reserve values and backing ratio in real-time
                  </p>
                </div>
              </div>
            </Card>

            {/* Airdrop Eligibility Section */}
            <AirdropEligibilityCard />

            {/* Reserve Chart Preview */}
            <div className="h-48">
              <TrzryReserveChart />
            </div>

            {/* Learn More Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/trzry-reserves")}
            >
              View Full Analytics
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </TabsContent>

          {/* Buy TRZRY Tab */}
          <TabsContent value="buy" className="space-y-4 mt-0">
            {/* Current Price Card */}
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Current TRZRY Price</p>
                <p className="text-2xl font-bold text-foreground mb-1">$1.10</p>
                <p className="text-xs text-primary">+2.5% (24h)</p>
              </div>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Min. Purchase</p>
                <p className="text-sm font-semibold text-foreground">10 USDC</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Swap Fee</p>
                <p className="text-sm font-semibold text-foreground">0.3%</p>
              </Card>
            </div>

            {/* How to Buy Steps */}
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">How to Buy TRZRY</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    1
                  </div>
                  <p className="text-muted-foreground pt-0.5">
                    Make sure you have USDC in your wallet
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    2
                  </div>
                  <p className="text-muted-foreground pt-0.5">
                    Enter the amount of TRZRY you want to buy
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    3
                  </div>
                  <p className="text-muted-foreground pt-0.5">
                    Review your quote and confirm the swap
                  </p>
                </div>
              </div>
            </Card>

            {/* Referral Dashboard */}
            <ReferralDashboard />

            {/* CTA Button */}
            <Button
              className="w-full h-12 text-base font-semibold bg-primary text-black hover:bg-primary/90"
              onClick={() => navigate("/swap?to=TRZRY")}
            >
              Buy TRZRY Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            {/* Info Note */}
            <Card className="p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                💡 <span className="font-medium text-foreground">Tip:</span> TRZRY is designed for long-term growth. The longer you hold, the more you benefit from reserve appreciation.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default TrzryHub;
