import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePortfolioMonitoring } from "@/hooks/usePortfolioMonitoring";
import { PortfolioSummaryCard } from "@/components/portfolio/PortfolioSummaryCard";
import { HealthMonitorCard } from "@/components/portfolio/HealthMonitorCard";
import { AssetAllocationChart } from "@/components/portfolio/AssetAllocationChart";
import { PositionsCard } from "@/components/portfolio/PositionsCard";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";
import { useState } from "react";

export default function Portfolio() {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const {
    portfolioSummary,
    portfolioPerformance,
    portfolioAssets,
    assetsByType,
    loading
  } = usePortfolioMonitoring();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Loading Portfolio...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <AurumLogo className="h-8" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-6 pb-24 space-y-6">
        {/* Portfolio Summary */}
        <PortfolioSummaryCard 
          summary={portfolioSummary}
          performance={portfolioPerformance}
        />

        {/* Health Monitor */}
        <HealthMonitorCard summary={portfolioSummary} />

        {/* Asset Allocation & Positions */}
        <div className="grid gap-6 md:grid-cols-2">
          <AssetAllocationChart assets={portfolioAssets} />
          <PositionsCard assetsByType={assetsByType} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={() => navigate('/lending?tab=supply')}
            variant="default"
            className="h-12"
          >
            Supply Assets
          </Button>
          <Button 
            onClick={() => navigate('/lending?tab=borrow')}
            variant="outline"
            className="h-12"
          >
            Borrow Assets
          </Button>
        </div>

        {/* Performance Summary */}
        <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
          <h3 className="font-semibold">Performance Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Interest Earned</p>
              <p className="font-semibold text-status-success">
                +${portfolioPerformance.totalEarnedInterest.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Interest Paid</p>
              <p className="font-semibold text-status-error">
                -${portfolioPerformance.totalPaidInterest.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </p>
            </div>
          </div>
          <div className="border-t border-border pt-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Net Interest</span>
              <span className={`font-semibold ${
                portfolioPerformance.netInterest >= 0 ? 'text-status-success' : 'text-status-error'
              }`}>
                {portfolioPerformance.netInterest >= 0 ? '+' : ''}
                ${portfolioPerformance.netInterest.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </span>
            </div>
          </div>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}