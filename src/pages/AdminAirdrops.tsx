import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Calendar, Gift, TrendingUp, Plus } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import BottomNavigation from '@/components/BottomNavigation';
import AurumLogo from '@/components/AurumLogo';
import { useAdminSessionTimeout } from '@/hooks/useAdminSessionTimeout';
import { toast } from '@/hooks/use-toast';

interface AirdropPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  distribution_date: string | null;
  total_pool_size: number;
  status: string;
  points_multiplier: number;
}

const AdminAirdrops = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();
  const [periods, setPeriods] = useState<AirdropPeriod[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPeriod, setNewPeriod] = useState({
    period_name: '',
    start_date: '',
    end_date: '',
    distribution_date: '',
    total_pool_size: '',
    points_multiplier: '1.0'
  });

  useAdminSessionTimeout(isAdmin, 15);

  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/');
      return;
    }

    if (isAdmin) {
      fetchAirdropPeriods();
    }
  }, [isAdmin, loading, navigate]);

  const fetchAirdropPeriods = async () => {
    const { data } = await supabase
      .from('airdrop_periods')
      .select('*')
      .order('start_date', { ascending: false });

    if (data) {
      setPeriods(data);
    }
  };

  const createAirdropPeriod = async () => {
    if (!newPeriod.period_name || !newPeriod.start_date || !newPeriod.end_date || !newPeriod.total_pool_size) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('airdrop_periods')
      .insert({
        period_name: newPeriod.period_name,
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        distribution_date: newPeriod.distribution_date || null,
        total_pool_size: parseFloat(newPeriod.total_pool_size),
        points_multiplier: parseFloat(newPeriod.points_multiplier),
        status: 'upcoming'
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create airdrop period",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: "Airdrop period created successfully",
    });

    setCreateDialogOpen(false);
    setNewPeriod({
      period_name: '',
      start_date: '',
      end_date: '',
      distribution_date: '',
      total_pool_size: '',
      points_multiplier: '1.0'
    });
    fetchAirdropPeriods();
  };

  const activatePeriod = async (periodId: string) => {
    const { error } = await supabase
      .from('airdrop_periods')
      .update({ status: 'active' })
      .eq('id', periodId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to activate period",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: "Airdrop period activated",
    });

    fetchAirdropPeriods();
  };

  const completePeriod = async (periodId: string) => {
    const { error } = await supabase
      .from('airdrop_periods')
      .update({ status: 'completed' })
      .eq('id', periodId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to complete period",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: "Airdrop period marked as completed",
    });

    fetchAirdropPeriods();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'bg-blue-500',
      active: 'bg-green-500',
      completed: 'bg-gray-500',
      cancelled: 'bg-red-500'
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Access Denied</p>
          <Button onClick={() => navigate('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 border-b border-border">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex items-center gap-3 flex-1 justify-center pr-6">
            <AurumLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold">Airdrop Management</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Periods</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{periods.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {periods.filter(p => p.status === 'active').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {periods.filter(p => p.status === 'upcoming').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pool</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {periods.reduce((sum, p) => sum + p.total_pool_size, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Airdrop Periods Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Airdrop Periods</CardTitle>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Period
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Airdrop Period</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Period Name *</Label>
                    <Input
                      placeholder="e.g., February 2025"
                      value={newPeriod.period_name}
                      onChange={(e) => setNewPeriod({ ...newPeriod, period_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date *</Label>
                      <Input
                        type="date"
                        value={newPeriod.start_date}
                        onChange={(e) => setNewPeriod({ ...newPeriod, start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>End Date *</Label>
                      <Input
                        type="date"
                        value={newPeriod.end_date}
                        onChange={(e) => setNewPeriod({ ...newPeriod, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Distribution Date (Optional)</Label>
                    <Input
                      type="date"
                      value={newPeriod.distribution_date}
                      onChange={(e) => setNewPeriod({ ...newPeriod, distribution_date: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Pool Size (TRZRY) *</Label>
                      <Input
                        type="number"
                        placeholder="1000"
                        value={newPeriod.total_pool_size}
                        onChange={(e) => setNewPeriod({ ...newPeriod, total_pool_size: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Points Multiplier</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="1.0"
                        value={newPeriod.points_multiplier}
                        onChange={(e) => setNewPeriod({ ...newPeriod, points_multiplier: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button onClick={createAirdropPeriod} className="w-full">
                    Create Period
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Pool Size</TableHead>
                    <TableHead>Multiplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium">{period.period_name}</TableCell>
                      <TableCell>{new Date(period.start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(period.end_date).toLocaleDateString()}</TableCell>
                      <TableCell>{period.total_pool_size.toLocaleString()} TRZRY</TableCell>
                      <TableCell>{period.points_multiplier}x</TableCell>
                      <TableCell>{getStatusBadge(period.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {period.status === 'upcoming' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activatePeriod(period.id)}
                            >
                              Activate
                            </Button>
                          )}
                          {period.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => completePeriod(period.id)}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default AdminAirdrops;
