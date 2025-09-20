import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Wallet, DollarSign, TrendingUp, Activity, AlertCircle, Clock, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { feeCollectionService, FeeCollectionSummary, PlatformFeeRecord } from "@/services/feeCollectionService";
import { feeCollectionBot } from "@/services/feeCollectionBot";
import { blockchainService } from "@/services/blockchainService";
import { adminFeeAnalyticsService, FeeAnalytics, FeeTypeMetrics } from "@/services/adminFeeAnalyticsService";
import { useAdmin } from "@/hooks/useAdmin";
import ChainAnalytics from "@/components/admin/ChainAnalytics";
import { useToast } from "@/hooks/use-toast";

const AdminFees = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getFeeAnalytics } = useAdmin();
  const [summary, setSummary] = useState<FeeCollectionSummary | null>(null);
  const [recentFees, setRecentFees] = useState<PlatformFeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [botStats, setBotStats] = useState<any>(null);
  const [collectingFees, setCollectingFees] = useState(false);
  const [feeAnalytics, setFeeAnalytics] = useState<any>(null);
  const [feeTypeMetrics, setFeeTypeMetrics] = useState<FeeTypeMetrics[]>([]);
  const [collectionHealth, setCollectionHealth] = useState<any>(null);
  const [realtimeMonitoring, setRealtimeMonitoring] = useState<any>(null);

  useEffect(() => {
    loadFeeData();
  }, []);

  const loadFeeData = async () => {
    try {
      setLoading(true);
      const [
        summaryData, 
        feesData, 
        stats, 
        analytics, 
        typeMetrics, 
        health, 
        realtime
      ] = await Promise.all([
        feeCollectionService.getFeeCollectionSummary(),
        feeCollectionService.getCollectedFees(),
        feeCollectionBot.getFeeCollectionStats(),
        getFeeAnalytics(), // Use the updated chain-aware function
        adminFeeAnalyticsService.getFeeTypeMetrics(),
        adminFeeAnalyticsService.getCollectionHealth(),
        adminFeeAnalyticsService.getRealtimeMonitoring()
      ]);
      
      setSummary(summaryData);
      setRecentFees(feesData.slice(0, 10));
      setBotStats(stats);
      setFeeAnalytics(analytics);
      setFeeTypeMetrics(typeMetrics);
      setCollectionHealth(health);
      setRealtimeMonitoring(realtime);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Loading Fees",
        description: "Failed to load fee collection data"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCollectFees = async () => {
    try {
      setCollectingFees(true);
      const results = await feeCollectionBot.collectAllPendingFees();
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        toast({
          title: "Fees Collected",
          description: `Successfully collected ${successCount} fees${failCount > 0 ? `, ${failCount} failed` : ''}`
        });
        loadFeeData(); // Refresh data
      } else if (failCount > 0) {
        toast({
          variant: "destructive",
          title: "Collection Failed",
          description: `Failed to collect ${failCount} fees`
        });
      } else {
        toast({
          title: "No Fees to Collect",
          description: "All platform fees have already been collected"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Collection Error",
        description: "Failed to collect platform fees"
      });
    } finally {
      setCollectingFees(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const csvData = await adminFeeAnalyticsService.exportDetailedFeeReport();
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `detailed_fee_analytics_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Report Exported",
        description: "Detailed fee analytics report downloaded successfully"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export fee report"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <div className="text-muted-foreground">Loading comprehensive fee data...</div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Fee Management & Analytics</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-6 overflow-y-auto">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="collection">Collection</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Fee Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(feeAnalytics?.fee_breakdown.total_fees || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last 30 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {feeAnalytics?.collection_status.success_rate.toFixed(1) || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Success rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Wallet</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-mono break-all">
                    {blockchainService.getPlatformWallet()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fee collection address
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Fee Type Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {feeTypeMetrics.map((metric) => (
                <Card key={metric.type}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">{metric.type} Fees</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(metric.total_amount)}</div>
                    <p className="text-xs text-muted-foreground">
                      {metric.transaction_count} transactions • Avg: {formatCurrency(metric.average_fee)}
                    </p>
                    <div className="text-xs mt-1">
                      <span className={`font-medium ${metric.growth_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metric.growth_rate >= 0 ? '+' : ''}{metric.growth_rate.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground ml-1">vs avg daily</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            {/* Chain Analytics Component */}
            {feeAnalytics?.chain_analytics && (
              <ChainAnalytics 
                chainAnalytics={feeAnalytics.chain_analytics}
                chainBreakdown={feeAnalytics.collection_status?.chain_breakdown || {}}
              />
            )}

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Fee Activity</CardTitle>
                <CardDescription>Latest fee collections and trends</CardDescription>
              </CardHeader>
              <CardContent>
                {feeAnalytics?.recent_activity?.length ? (
                  <div className="space-y-4">
                    {feeAnalytics.recent_activity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <div className="font-medium capitalize">
                            {activity.transaction_type} - {activity.asset}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(activity.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(activity.amount)}</div>
                          <div className="text-sm text-muted-foreground">Platform Fee</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No recent fee activity
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="collection" className="space-y-6 mt-6">
            {/* Collection Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{collectionHealth?.totalRequests || 0}</div>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Successful</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{collectionHealth?.successfulCollections || 0}</div>
                  <p className="text-xs text-muted-foreground">Collections completed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{collectionHealth?.failedCollections || 0}</div>
                  <p className="text-xs text-muted-foreground">Collections failed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{collectionHealth?.avgCollectionTime?.toFixed(1) || 0}m</div>
                  <p className="text-xs text-muted-foreground">Collection time</p>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4 mb-6">
              <Button 
                onClick={handleCollectFees}
                disabled={collectingFees}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {collectingFees ? "Collecting..." : "Collect Fees Now"}
              </Button>
              <Button 
                onClick={handleExportReport}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Detailed Report
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(blockchainService.getPlatformWallet());
                  toast({
                    title: "Wallet Address Copied",
                    description: "Platform wallet address copied to clipboard"
                  });
                }}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Copy Platform Wallet
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6 mt-6">
            {/* Real-time Monitoring */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant={realtimeMonitoring?.isCollectionBotRunning ? "default" : "destructive"}>
                      {realtimeMonitoring?.isCollectionBotRunning ? "Running" : "Stopped"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Collection bot status
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Hour</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(realtimeMonitoring?.totalFeesThisHour || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {realtimeMonitoring?.successRateThisHour?.toFixed(1) || 0}% success rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Alerts</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {realtimeMonitoring?.alertsCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active alerts
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Failures */}
            {collectionHealth?.recentFailures?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Recent Collection Failures
                  </CardTitle>
                  <CardDescription>Issues that need attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {collectionHealth.recentFailures.map((failure: any, index: number) => (
                      <div key={index} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-red-800">
                              Failed to collect {formatCurrency(failure.amount)} {failure.asset}
                            </div>
                            <div className="text-sm text-red-600">
                              {new Date(failure.created_at).toLocaleString()}
                            </div>
                          </div>
                          <Badge variant="destructive">Failed</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
};

export default AdminFees;