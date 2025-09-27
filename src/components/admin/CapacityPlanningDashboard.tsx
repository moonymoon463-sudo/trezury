import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Server,
  Database,
  Gauge,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SystemAnalyticsService } from '@/services/SystemAnalyticsService';
import AurumLogo from '@/components/AurumLogo';

interface CapacityMetrics {
  current_load: number;
  projected_load: number;
  capacity_utilization: number;
  estimated_max_users: number;
  cost_per_user: number;
  scaling_recommendations: string[];
  bottlenecks: string[];
}

interface ForecastData {
  period: string;
  predicted_users: number;
  predicted_load: number;
  required_capacity: number;
  estimated_cost: number;
  confidence: number;
}

interface ResourceRecommendation {
  resource: string;
  current_usage: number;
  recommended_increase: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  cost_impact: number;
  timeline: string;
  description: string;
}

const CapacityPlanningDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<CapacityMetrics | null>(null);
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  const [recommendations, setRecommendations] = useState<ResourceRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadCapacityData = async () => {
    try {
      const [metricsData, forecastData, recommendationData] = await Promise.all([
        SystemAnalyticsService.getCapacityMetrics(),
        SystemAnalyticsService.getCapacityForecasts(),
        SystemAnalyticsService.getScalingRecommendations()
      ]);
      
      setMetrics(metricsData);
      setForecasts(forecastData);
      setRecommendations(recommendationData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load capacity data:', error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await loadCapacityData();
      setLoading(false);
    };

    initializeData();

    // Set up periodic updates
    const interval = setInterval(loadCapacityData, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <TrendingUp className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getLoadIndicator = (utilization: number) => {
    if (utilization >= 90) return { color: 'text-red-500', status: 'Critical' };
    if (utilization >= 80) return { color: 'text-orange-500', status: 'High' };
    if (utilization >= 60) return { color: 'text-yellow-500', status: 'Medium' };
    return { color: 'text-green-500', status: 'Optimal' };
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading capacity planning...</p>
          </div>
        </div>
      </div>
    );
  }

  const loadIndicator = getLoadIndicator(metrics?.capacity_utilization || 0);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin')}
              className="text-foreground hover:bg-accent"
            >
              <ArrowLeft size={24} />
            </Button>
            <AurumLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold text-foreground">Capacity Planning</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gauge className="w-4 h-4" />
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={loadCapacityData}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Current Capacity Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Load</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.current_load?.toFixed(1) || 0}%</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={loadIndicator.color}>
                  {loadIndicator.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity Utilization</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.capacity_utilization?.toFixed(1) || 0}%</div>
              <Progress value={metrics?.capacity_utilization || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Max Estimated Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.estimated_max_users?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">With current resources</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cost per User</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${metrics?.cost_per_user?.toFixed(2) || 0}</div>
              <p className="text-xs text-muted-foreground">Monthly average</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="forecasts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="forecasts">Growth Forecasts</TabsTrigger>
            <TabsTrigger value="recommendations">Scaling Recommendations</TabsTrigger>
            <TabsTrigger value="bottlenecks">System Bottlenecks</TabsTrigger>
          </TabsList>

          <TabsContent value="forecasts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Capacity Growth Forecasts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {forecasts.map((forecast, index) => (
                    <div key={index} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="font-medium">{forecast.period}</div>
                          <div className="text-sm text-muted-foreground">Period</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{forecast.predicted_users.toLocaleString()}</div>
                          <div className="text-muted-foreground">Users</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{forecast.predicted_load.toFixed(1)}%</div>
                          <div className="text-muted-foreground">Load</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{forecast.required_capacity.toFixed(1)}%</div>
                          <div className="text-muted-foreground">Capacity Needed</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{formatCurrency(forecast.estimated_cost)}</div>
                          <div className="text-muted-foreground">Est. Cost</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{forecast.confidence}%</div>
                          <div className="text-muted-foreground">Confidence</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scaling Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start justify-between p-4 rounded-lg border">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2 mt-1">
                          {getUrgencyIcon(rec.urgency)}
                          <Badge variant="default" className={getUrgencyColor(rec.urgency)}>
                            {rec.urgency}
                          </Badge>
                        </div>
                        <div>
                          <div className="font-medium">{rec.resource}</div>
                          <div className="text-sm text-muted-foreground mb-2">{rec.description}</div>
                          <div className="text-xs text-muted-foreground">
                            Timeline: {rec.timeline}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-medium">+{rec.recommended_increase}%</div>
                        <div className="text-muted-foreground">Current: {rec.current_usage}%</div>
                        <div className="text-muted-foreground">{formatCurrency(rec.cost_impact)}/month</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bottlenecks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Identified System Bottlenecks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.bottlenecks?.map((bottleneck, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <span>{bottleneck}</span>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>No critical bottlenecks detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.scaling_recommendations?.map((rec, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      <span>{rec}</span>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>System is well optimized</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CapacityPlanningDashboard;