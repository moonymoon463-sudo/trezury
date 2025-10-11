import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Shield, 
  ArrowLeft,
  UserCheck,
  AlertTriangle,
  Activity,
  Lock,
  Receipt,
  Clock,
  MessageCircle
} from 'lucide-react';
import { useAdmin, AdminStats } from '@/hooks/useAdmin';
import BottomNavigation from '@/components/BottomNavigation';
import AurumLogo from '@/components/AurumLogo';
import { AISystemTest } from '@/components/testing/AISystemTest';
import { NewsCollectionTrigger } from '@/components/admin/NewsCollectionTrigger';
import { LiveSwapMonitoring } from '@/components/admin/LiveSwapMonitoring';
import { useAdminSessionTimeout } from '@/hooks/useAdminSessionTimeout';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, getDashboardStats } = useAdmin();
  const [stats, setStats] = useState<AdminStats | null>(null);
  
  // Implement admin session timeout (15 minutes of inactivity)
  useAdminSessionTimeout(isAdmin, 15);

  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/');
      return;
    }

    const fetchStats = async () => {
      const dashboardStats = await getDashboardStats();
      setStats(dashboardStats);
    };

    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin, loading, getDashboardStats, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading admin dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">You don't have admin privileges to access this page.</p>
            <Button onClick={() => navigate('/')}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
            onClick={() => navigate('/')}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex items-center gap-3 flex-1 justify-center pr-6">
            <AurumLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
              <p className="text-xs text-muted-foreground">
                +{stats?.recent_signups || 0} this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.verified_users || 0}</div>
              <p className="text-xs text-muted-foreground">
                KYC verified
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.total_volume_usd || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.total_transactions || 0} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Locked Value</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.total_locked_value || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.active_locks || 0} active locks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fees Collected</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.total_fees_collected || 0)}</div>
              <p className="text-xs text-muted-foreground">
                All platform fees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fees This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.fees_this_month || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.fee_collection_rate?.toFixed(1) || 0}% collection rate
              </p>
            </CardContent>
          </Card>
        </div>


        {/* Quick Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/admin/support')}
                className="h-20 flex flex-col gap-2"
              >
                <MessageCircle className="h-6 w-6" />
                <span className="text-sm">Support Tickets</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/users')}
                className="h-20 flex flex-col gap-2"
              >
                <Users className="h-6 w-6" />
                <span className="text-sm">Manage Users</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/transactions')}
                className="h-20 flex flex-col gap-2"
              >
                <Activity className="h-6 w-6" />
                <span className="text-sm">Transactions</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/fees?tab=dashboard')}
                className="h-20 flex flex-col gap-2"
              >
                <TrendingUp className="h-6 w-6" />
                <span className="text-sm">Fee Dashboard</span>
              </Button>
              
              <Button
                variant="outline" 
                onClick={() => navigate('/admin/fees')}
                className="h-20 flex flex-col gap-2"
              >
                <DollarSign className="h-6 w-6" />
                <span className="text-sm">Internal Fees</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/fees-external')}
                className="h-20 flex flex-col gap-2"
              >
                <Receipt className="h-6 w-6" />
                <span className="text-sm">External Wallets</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/monitoring')}
                className="h-20 flex flex-col gap-2"
              >
                <Activity className="h-6 w-6" />
                <span className="text-sm">System Monitor</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/webhooks')}
                className="h-20 flex flex-col gap-2"
              >
                <Clock className="h-6 w-6" />
                <span className="text-sm">Webhooks</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/swap-analytics')}
                className="h-20 flex flex-col gap-2"
              >
                <TrendingUp className="h-6 w-6" />
                <span className="text-sm">Swap Analytics</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/alerts')}
                className="h-20 flex flex-col gap-2"
              >
                <Shield className="h-6 w-6" />
                <span className="text-sm">Alert Management</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Swap Monitoring */}
        <LiveSwapMonitoring />

        {/* AI Enhancement Testing */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AISystemTest />
          <NewsCollectionTrigger />
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Platform Status</span>
                <Badge variant="default" className="bg-green-500">Operational</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">AI Assistant</span>
                <Badge variant="default" className="bg-green-500">Enhanced</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Knowledge Base</span>
                <Badge variant="default" className="bg-green-500">22 FAQs + 6 Articles</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">KYC Service</span>
                <Badge variant="default" className="bg-green-500">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Payment Processing</span>
                <Badge variant="default" className="bg-green-500">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Blockchain Connection</span>
                <Badge variant="default" className="bg-green-500">Connected</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default AdminDashboard;