import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CrossChainLendingService, CrossChainSummary } from "@/services/crossChainLendingService";
import { chainValidationService } from "@/services/chainValidationService";
import { Chain } from "@/types/lending";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight,
  TrendingUp,
  BarChart3,
  Coins,
  Shield,
  Network,
  Zap
} from "lucide-react";

export function CrossChainDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [summary, setSummary] = useState<CrossChainSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>('all');

  const supportedChains = chainValidationService.getSupportedChains();

  useEffect(() => {
    if (user) {
      fetchCrossChainSummary();
    }
  }, [user]);

  const fetchCrossChainSummary = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await CrossChainLendingService.getCrossChainSummary(user.id);
      setSummary(data);
    } catch (error) {
      console.error('Error fetching cross-chain summary:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch cross-chain data"
      });
    } finally {
      setLoading(false);
    }
  };

  const getChainColor = (chain: string) => {
    switch (chain) {
      case 'ethereum': return 'text-blue-600';
      case 'base': return 'text-blue-500';
      case 'solana': return 'text-purple-600';
      case 'tron': return 'text-red-600';
      default: return 'text-neutral-600';
    }
  };

  const getChainBadgeVariant = (chain: string) => {
    switch (chain) {
      case 'ethereum': return 'default';
      case 'base': return 'secondary';
      case 'solana': return 'outline';
      case 'tron': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
                <div className="h-8 bg-neutral-200 rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-8">
        <Network className="h-12 w-12 mx-auto mb-4 text-neutral-400" />
        <h3 className="text-lg font-semibold mb-2">No Cross-Chain Positions</h3>
        <p className="text-neutral-600 mb-4">
          Start lending on multiple chains to see your cross-chain portfolio
        </p>
        <Button onClick={fetchCrossChainSummary}>
          Refresh Data
        </Button>
      </div>
    );
  }

  const filteredPositions = selectedChain === 'all' 
    ? Object.entries(summary.positions_by_chain).flatMap(([chain, positions]) => 
        positions.map(pos => ({ ...pos, chain }))
      )
    : summary.positions_by_chain[selectedChain as Chain] || [];

  return (
    <div className="space-y-6">
      {/* Cross-Chain Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Supplied</CardTitle>
            <TrendingUp className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {CrossChainLendingService.formatUSD(summary.total_supplied_usd)}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Across {Object.keys(summary.positions_by_chain).length} chains
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Borrowed</CardTitle>
            <BarChart3 className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {CrossChainLendingService.formatUSD(summary.total_borrowed_usd)}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Multi-chain debt positions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weighted Health Factor</CardTitle>
            <Shield className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.weighted_health_factor > 999 ? '∞' : summary.weighted_health_factor.toFixed(3)}
            </div>
            <div className="mt-1">
              <Badge variant={summary.weighted_health_factor >= 1.5 ? 'default' : 'destructive'}>
                {summary.weighted_health_factor >= 1.5 ? 'Healthy' : 'At Risk'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net APY</CardTitle>
            <Coins className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.net_apy.toFixed(2)}%
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Portfolio-weighted return
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chain Selection and Positions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Cross-Chain Positions
          </CardTitle>
          <CardDescription>
            Manage your lending positions across multiple blockchain networks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedChain} onValueChange={setSelectedChain}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All Chains</TabsTrigger>
              {supportedChains.map((chain) => (
                <TabsTrigger key={chain} value={chain}>
                  <Badge variant={getChainBadgeVariant(chain)} className="text-xs">
                    {CrossChainLendingService.formatChainName(chain)}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-6">
              {filteredPositions.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <Coins className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No positions found for selected chain(s)</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPositions.map((position, index) => (
                    <div key={`${position.chain}-${position.asset}-${index}`} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge variant={getChainBadgeVariant(position.chain)}>
                            {CrossChainLendingService.formatChainName(position.chain)}
                          </Badge>
                          <h4 className="font-semibold">{position.asset}</h4>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-neutral-500">Health Factor</div>
                          <div className="font-medium">
                            {position.health_factor > 999 ? '∞' : position.health_factor.toFixed(3)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Supply Position */}
                        {position.supplied_amount > 0 && (
                          <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                              <span className="text-sm font-medium text-emerald-800">Supplied</span>
                            </div>
                            <div className="text-lg font-bold text-emerald-900">
                              {CrossChainLendingService.formatAmount(position.supplied_amount, position.asset)}
                            </div>
                            <div className="text-sm text-emerald-600">
                              Earning {CrossChainLendingService.formatAPY(position.apy_earned)}
                            </div>
                          </div>
                        )}

                        {/* Borrow Position */}
                        {position.borrowed_amount > 0 && (
                          <div className="p-3 bg-orange-50 rounded border border-orange-200">
                            <div className="flex items-center gap-2 mb-2">
                              <BarChart3 className="h-4 w-4 text-orange-600" />
                              <span className="text-sm font-medium text-orange-800">Borrowed</span>
                            </div>
                            <div className="text-lg font-bold text-orange-900">
                              {CrossChainLendingService.formatAmount(position.borrowed_amount, position.asset)}
                            </div>
                            <div className="text-sm text-orange-600">
                              Paying {CrossChainLendingService.formatAPY(position.apy_owed)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Position Actions */}
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm">
                          <ArrowLeftRight className="h-4 w-4 mr-1" />
                          Bridge Assets
                        </Button>
                        <Button variant="outline" size="sm">
                          <Zap className="h-4 w-4 mr-1" />
                          Optimize
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Chain Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Chain Performance</CardTitle>
          <CardDescription>
            Compare lending rates and opportunities across different chains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {supportedChains.map((chain) => {
              const chainPositions = summary.positions_by_chain[chain] || [];
              const chainSuppliedTotal = chainPositions.reduce((sum, pos) => sum + pos.supplied_amount, 0);
              const chainBorrowedTotal = chainPositions.reduce((sum, pos) => sum + pos.borrowed_amount, 0);
              const chainUtilization = chainSuppliedTotal > 0 ? (chainBorrowedTotal / chainSuppliedTotal) * 100 : 0;

              return (
                <div key={chain} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant={getChainBadgeVariant(chain)}>
                      {CrossChainLendingService.formatChainName(chain)}
                    </Badge>
                    <div>
                      <div className="font-medium">
                        {CrossChainLendingService.formatUSD(chainSuppliedTotal)} supplied
                      </div>
                      <div className="text-sm text-neutral-500">
                        {chainPositions.length} active positions
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-neutral-500 mb-1">Utilization</div>
                    <div className="flex items-center gap-2">
                      <Progress value={chainUtilization} className="w-20 h-2" />
                      <span className="text-sm font-medium">{chainUtilization.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}