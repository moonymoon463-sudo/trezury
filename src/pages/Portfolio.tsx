import { ArrowLeft, RefreshCw, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePortfolioMonitoring } from "@/hooks/usePortfolioMonitoring";
import { usePortfolioAI } from "@/hooks/usePortfolioAI";
import { PortfolioSummaryCard } from "@/components/portfolio/PortfolioSummaryCard";
import { HealthMonitorCard } from "@/components/portfolio/HealthMonitorCard";
import { AssetAllocationChart } from "@/components/portfolio/AssetAllocationChart";
import { PositionsCard } from "@/components/portfolio/PositionsCard";
import { AIInsightsPanel } from "@/components/portfolio/AIInsightsPanel";
import { MarketForecast } from "@/components/portfolio/MarketForecast";
import { RiskAnalysis } from "@/components/portfolio/RiskAnalysis";
import { PerformanceAnalytics } from "@/components/portfolio/PerformanceAnalytics";
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
    loading,
    refreshData
  } = usePortfolioMonitoring();

  const {
    insights,
    forecasts,
    riskAssessment,
    loading: aiLoading,
    refreshAnalysis
  } = usePortfolioAI();

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <Brain className="h-8 w-8 mx-auto text-primary animate-pulse" />
          <h2 className="text-2xl font-semibold">Loading Portfolio...</h2>
          <p className="text-muted-foreground">Analyzing your holdings with AI</p>
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
          <AurumLogo compact={true} className="h-6" />
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
          assets={portfolioAssets}
        />

        {/* AI Insights Panel */}
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
          performance={portfolioPerformance}
          loading={loading}
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
            onClick={() => navigate('/buy-gold')}
            variant="default"
            className="h-12"
          >
            Buy Gold
          </Button>
          <Button 
            onClick={() => navigate('/trzry-reserves')}
            variant="outline"
            className="h-12"
          >
            TRZRY Reserves
          </Button>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}