import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Wallet, DollarSign, TrendingUp, Activity, AlertCircle, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { feeCollectionService, FeeCollectionSummary, PlatformFeeRecord } from "@/services/feeCollectionService";
import { blockchainService } from "@/services/blockchainService";
import { useAdmin } from "@/hooks/useAdmin";
import { useFeeCollectionDashboard } from "@/hooks/useFeeCollectionDashboard";
import ChainAnalytics from "@/components/admin/ChainAnalytics";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const AdminFees = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { getFeeAnalytics } = useAdmin();
  const { stats: dashboardStats, loading: dashboardLoading, refresh: refreshDashboard } = useFeeCollectionDashboard();
  const [summary, setSummary] = useState<FeeCollectionSummary | null>(null);
  const [recentFees, setRecentFees] = useState<PlatformFeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectingFees, setCollectingFees] = useState(false);
  const [feeAnalytics, setFeeAnalytics] = useState<any>(null);
  
  const defaultTab = searchParams.get('tab') || 'overview';

  useEffect(() => {
    loadFeeData();
  }, []);

  const loadFeeData = async () => {
    try {
      setLoading(true);
      const [
        summaryData, 
        feesData, 
        analytics
      ] = await Promise.all([
        feeCollectionService.getFeeCollectionSummary(),
        feeCollectionService.getCollectedFees(),
        getFeeAnalytics()
      ]);
      
      setSummary(summaryData);
      setRecentFees(feesData.slice(0, 10));
      setFeeAnalytics(analytics);
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
    toast({
      title: "Feature Unavailable",
      description: "Automated fee collection has been disabled"
    });
  };

  const handleExportReport = async () => {
    toast({
      title: "Feature Unavailable",
      description: "Report export has been disabled"
    });
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
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="collection">Collection</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {dashboardLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                {/* Real-time Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Fees</CardTitle>
                      <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{dashboardStats?.pending_count || 0}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(dashboardStats?.pending_amount || 0)} total
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Success Rate (24h)</CardTitle>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{dashboardStats?.success_rate_24h?.toFixed(1) || 0}%</div>
                      <Progress value={dashboardStats?.success_rate_24h || 0} className="mt-2" />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Last Collection</CardTitle>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      {dashboardStats?.last_collection ? (
                        <>
                          <div className="text-sm font-medium">
                            {formatDistanceToNow(new Date(dashboardStats.last_collection.completed_at), { addSuffix: true })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(dashboardStats.last_collection.amount)} {dashboardStats.last_collection.asset}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">No collections yet</div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
                      <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm font-medium">Daily at 2:00 AM UTC</div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 p-0 h-auto"
                        onClick={refreshDashboard}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Batch Collection Status Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Batch Collections (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dashboardStats?.batch_history?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Chain</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead>Failed</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Success Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboardStats.batch_history.map((batch, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{new Date(batch.date).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{batch.chain}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="default" className="bg-green-500">{batch.completed_count}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive">{batch.failed_count}</Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(batch.total_amount)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{batch.success_rate.toFixed(1)}%</span>
                                  <Progress value={batch.success_rate} className="w-16" />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No batch collection history available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Live Pending Requests */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Fee Requests</CardTitle>
                    <CardDescription>Real-time view of uncollected fees (showing up to 20)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboardStats?.pending_requests?.length ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {dashboardStats.pending_requests.map((request) => (
                          <div key={request.id} className="flex justify-between items-center p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{request.asset}</span>
                                <Badge variant="outline" className="text-xs">{request.chain}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Created {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {request.from_address.slice(0, 10)}...{request.from_address.slice(-8)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{request.amount.toFixed(6)}</div>
                              <div className="text-xs text-muted-foreground">{request.asset}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No pending fee requests
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Asset Breakdown */}
                {dashboardStats?.asset_breakdown && Object.keys(dashboardStats.asset_breakdown).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Pending Fees by Asset</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(dashboardStats.asset_breakdown).map(([asset, amount]) => (
                          <div key={asset} className="flex items-center justify-between p-3 border border-border rounded-lg">
                            <div className="font-medium">{asset}</div>
                            <div className="text-right">
                              <div className="font-bold">{(amount as number).toFixed(6)}</div>
                              <div className="text-xs text-muted-foreground">{asset}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

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

            {/* Fee Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Trading Fees</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(feeAnalytics?.fee_breakdown?.trading_fees || 0)}</div>
                  <p className="text-xs text-muted-foreground">Buy/Sell transactions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Swap Fees</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(feeAnalytics?.fee_breakdown?.swap_fees || 0)}</div>
                  <p className="text-xs text-muted-foreground">Asset swaps</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Collected</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(feeAnalytics?.collection_status?.collected_fees || 0)}</div>
                  <p className="text-xs text-muted-foreground">Successfully collected</p>
                </CardContent>
              </Card>
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
            {/* Collection Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Collected Fees</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(feeAnalytics?.collection_status?.collected_fees || 0)}</div>
                  <p className="text-xs text-muted-foreground">Successfully collected</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Fees</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{formatCurrency(feeAnalytics?.collection_status?.pending_fees || 0)}</div>
                  <p className="text-xs text-muted-foreground">Awaiting collection</p>
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
            {/* Monitoring Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Collection Status</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Manual</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Manual fee collection only
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {feeAnalytics?.collection_status?.success_rate?.toFixed(1) || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Collection success rate
                  </p>
                </CardContent>
              </Card>
            </div>

          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
};

export default AdminFees;