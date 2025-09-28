import { ArrowLeft, RefreshCw, Brain, Wifi, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMobileOptimizedPortfolio } from "@/hooks/useMobileOptimizedPortfolio";
import { useOptimizedPortfolioAI } from "@/hooks/useOptimizedPortfolioAI";
import { PortfolioSummaryCard } from "@/components/portfolio/PortfolioSummaryCard";
import { HealthMonitorCard } from "@/components/portfolio/HealthMonitorCard";
import { AssetAllocationChart } from "@/components/portfolio/AssetAllocationChart";
import { PositionsCard } from "@/components/portfolio/PositionsCard";
import { AIInsightsPanel } from "@/components/portfolio/AIInsightsPanel";
import { MarketForecast } from "@/components/portfolio/MarketForecast";
import { RiskAnalysis } from "@/components/portfolio/RiskAnalysis";
import { PerformanceAnalytics } from "@/components/portfolio/PerformanceAnalytics";
import { MobileLoadingSkeleton } from "@/components/portfolio/MobileLoadingSkeleton";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";
import StandardHeader from "@/components/StandardHeader";
import { useState } from "react";

export default function Portfolio() {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use mobile-optimized portfolio hook
  const {
    portfolioAssets,
    portfolioSummary,
    loading,
    error,
    isOffline,
    isMobile,
    refreshData,
    totalValue
  } = useMobileOptimizedPortfolio();

  const {
    insights,
    forecasts,
    riskAssessment,
    loading: aiLoading,
    refreshAnalysis
  } = useOptimizedPortfolioAI();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshData(), refreshAnalysis()]);
    } catch (error) {
      console.error('Failed to refresh portfolio data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Progressive loading: only show skeleton if no data at all
  if (loading && portfolioAssets.length === 0 && isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <StandardHeader 
          showBackButton
          backPath="back"
          showRefreshButton
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <main className="px-3 md:px-6 py-4 md:py-6 pb-12 md:pb-16">
          <MobileLoadingSkeleton />
        </main>
        <BottomNavigation />
      </div>
    );
  }

  // Desktop: only show full loading if no data
  if (loading && portfolioAssets.length === 0 && !isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <Brain className="h-8 w-8 mx-auto text-primary animate-pulse" />
          <h2 className="text-2xl font-semibold">Loading Portfolio...</h2>
          <p className="text-muted-foreground">Getting your latest data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <StandardHeader 
        showBackButton
        backPath="back"
        showRefreshButton
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main Content */}
      <main className="px-3 md:px-6 py-4 md:py-6 pb-12 md:pb-16 space-y-4 md:space-y-6">
        {/* Offline/Error Alert */}
        {isOffline && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You're offline. Showing cached portfolio data.
            </AlertDescription>
          </Alert>
        )}
        
        {error && !isOffline && (
          <Alert variant="destructive">
            <AlertDescription>
              {error} {isMobile && "- Using cached data if available"}
            </AlertDescription>
          </Alert>
        )}

        {/* Asset Allocation */}
        <AssetAllocationChart assets={portfolioAssets} />

        {/* AI Insights Panel - Independent loading */}
        <AIInsightsPanel 
          insights={insights}
          loading={aiLoading}
          onRefresh={refreshAnalysis}
        />

        {/* Market Forecasts & Risk Analysis */}
        <div className="grid gap-6 md:grid-cols-2">
          <MarketForecast 
            forecasts={forecasts}
            loading={aiLoading}
          />
          <RiskAnalysis 
            riskAssessment={riskAssessment}
            loading={aiLoading}
          />
        </div>

        {/* Performance Analytics */}
        <PerformanceAnalytics 
          summary={portfolioSummary}
          performance={{
            period: '24h',
            return: 0
          }}
          loading={loading}
        />

        {/* Health Monitor */}
        <HealthMonitorCard summary={portfolioSummary} />

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={() => navigate('/buy-gold')}
            variant="default"
            className="h-12"
          >
            Buy Gold
          </Button>
          <Button 
            onClick={() => navigate('/auto-invest')}
            variant="outline"
            className="h-12"
          >
            Auto-Invest
          </Button>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}