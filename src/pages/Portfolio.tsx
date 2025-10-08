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
import { AdvancedAnalytics } from "@/components/portfolio/AdvancedAnalytics";
import { RealTimeAlerts } from "@/components/portfolio/RealTimeAlerts";
import { PerformanceAnalytics } from "@/components/portfolio/PerformanceAnalytics";
import { MobileLoadingSkeleton } from "@/components/portfolio/MobileLoadingSkeleton";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";
import StandardHeader from "@/components/StandardHeader";
import { useState, useEffect, useRef } from "react";
import { blockchainMonitoringService } from "@/services/blockchainMonitoringService";
import { useAuth } from "@/hooks/useAuth";

export default function Portfolio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();
  
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

  // Start blockchain monitoring when user logs in
  useEffect(() => {
    const startMonitoring = async () => {
      if (user?.id) {
        const addresses = await blockchainMonitoringService.getUserWalletAddresses(user.id);
        if (addresses.length > 0) {
          console.log('🔍 Starting blockchain monitoring for', addresses.length, 'addresses');
          await blockchainMonitoringService.startMonitoring(addresses);
        }
      }
    };

    startMonitoring();

    return () => {
      blockchainMonitoringService.stopMonitoring();
    };
  }, [user?.id]);

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

  // CRITICAL: Force loading screen to timeout after 2 seconds
  useEffect(() => {
    if (loading && portfolioAssets.length === 0) {
      // Start 2-second timeout
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Loading timeout reached - forcing content display');
        setHasTimedOut(true);
      }, 2000);
    } else {
      setHasTimedOut(false);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loading, portfolioAssets.length]);

  // Progressive loading: only show skeleton if no data at all AND not timed out
  if (loading && portfolioAssets.length === 0 && !hasTimedOut && isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <StandardHeader 
          showBackButton
          backPath="back"
          showRefreshButton
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <main className="pt-14 sm:pt-16 lg:pt-18 px-3 md:px-6 pb-12 md:pb-16">
          <MobileLoadingSkeleton />
        </main>
        <BottomNavigation />
      </div>
    );
  }

  // Desktop: only show full loading if no data AND not timed out
  if (loading && portfolioAssets.length === 0 && !hasTimedOut && !isMobile) {
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
      <main className="pt-[calc(3.5rem+max(8px,env(safe-area-inset-top))+0.5rem)] px-1 sm:px-2 md:px-6 pb-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom)+0.5rem)] space-y-2 sm:space-y-3 md:space-y-4">
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

        {/* Main Content Grid */}
        <div className="grid gap-2 sm:gap-4 lg:gap-6 lg:grid-cols-3">
          {/* Left Column - Primary content */}
          <div className="lg:col-span-2 space-y-2 sm:space-y-4 lg:space-y-6">
            {/* AI Insights Panel with Asset Allocation */}
            <AIInsightsPanel 
              insights={insights}
              loading={aiLoading}
              onRefresh={refreshAnalysis}
              portfolioAssets={portfolioAssets}
            />

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
          </div>

          {/* Right Column - Analysis Tools */}
          <div className="lg:col-span-1 space-y-2 sm:space-y-4 lg:space-y-6">
            {/* Market Forecasts */}
            <MarketForecast 
              forecasts={forecasts}
              loading={aiLoading}
            />

            {/* Risk Analysis */}
            <RiskAnalysis 
              riskAssessment={riskAssessment}
              loading={aiLoading}
            />

            {/* Real-Time Alerts */}
            <RealTimeAlerts />
          </div>
        </div>

        {/* Advanced Analytics Section */}
        <div className="mt-8">
          <AdvancedAnalytics 
            portfolioData={{
              totalValue,
              assets: portfolioAssets,
              summary: portfolioSummary
            }}
          />
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center mt-6">
          <Button 
            onClick={() => navigate('/buy-gold')}
            variant="default"
            className="h-12 w-full max-w-xs"
          >
            Buy Gold
          </Button>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}