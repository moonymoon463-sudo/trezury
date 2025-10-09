import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, TrendingUp, Gift, Award, Search } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import BottomNavigation from '@/components/BottomNavigation';
import AurumLogo from '@/components/AurumLogo';
import { useAdminSessionTimeout } from '@/hooks/useAdminSessionTimeout';
import { toast } from '@/hooks/use-toast';

interface ReferralStats {
  total_codes: number;
  total_points_awarded: number;
  total_referrals: number;
  active_referrals: number;
}

interface TopReferrer {
  user_id: string;
  email: string;
  referral_code: string;
  total_referrals: number;
  total_points: number;
  active_referrals: number;
}

const AdminReferrals = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [manualPoints, setManualPoints] = useState('');
  const [manualReason, setManualReason] = useState('');

  useAdminSessionTimeout(isAdmin, 15);

  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/');
      return;
    }

    if (isAdmin) {
      fetchReferralStats();
      fetchTopReferrers();
    }
  }, [isAdmin, loading, navigate]);

  const fetchReferralStats = async () => {
    const { data: codes } = await supabase
      .from('referral_codes')
      .select('code');

    const { data: referrals } = await supabase
      .from('referrals')
      .select('status, points_awarded');

    const { data: balances } = await supabase
      .from('referral_point_balances')
      .select('total_points');

    setStats({
      total_codes: codes?.length || 0,
      total_points_awarded: balances?.reduce((sum, b) => sum + b.total_points, 0) || 0,
      total_referrals: referrals?.length || 0,
      active_referrals: referrals?.filter(r => r.status === 'completed').length || 0
    });
  };

  const fetchTopReferrers = async () => {
    const { data } = await supabase
      .from('referral_codes')
      .select(`
        user_id,
        code,
        referrals:referrals(count, status)
      `)
      .limit(10);

    if (!data) return;

    const referrersWithDetails = await Promise.all(
      data.map(async (item) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', item.user_id)
          .single();

        const { data: balance } = await supabase
          .from('referral_point_balances')
          .select('total_points')
          .eq('user_id', item.user_id)
          .single();

        const totalReferrals = item.referrals?.length || 0;
        const activeReferrals = item.referrals?.filter((r: any) => r.status === 'completed').length || 0;

        return {
          user_id: item.user_id,
          email: profile?.email || 'Unknown',
          referral_code: item.code,
          total_referrals: totalReferrals,
          active_referrals: activeReferrals,
          total_points: balance?.total_points || 0
        };
      })
    );

    setTopReferrers(
      referrersWithDetails.sort((a, b) => b.total_referrals - a.total_referrals)
    );
  };

  const searchUser = async () => {
    if (!searchEmail) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', searchEmail.toLowerCase())
      .single();

    if (!profile) {
      toast({
        title: "User Not Found",
        description: "No user with that email exists",
        variant: "destructive"
      });
      return;
    }

    const { data: code } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', profile.id)
      .single();

    const { data: balance } = await supabase
      .from('referral_point_balances')
      .select('total_points')
      .eq('user_id', profile.id)
      .single();

    const { data: history } = await supabase
      .from('referral_points')
      .select('*')
      .eq('user_id', profile.id)
      .order('earned_at', { ascending: false })
      .limit(10);

    setSearchResult({
      ...profile,
      referral_code: code?.code || 'None',
      total_points: balance?.total_points || 0,
      point_history: history || []
    });
  };

  const awardPoints = async () => {
    if (!searchResult || !manualPoints || !manualReason) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const points = parseInt(manualPoints);
    if (isNaN(points) || points === 0) {
      toast({
        title: "Invalid Points",
        description: "Please enter a valid number",
        variant: "destructive"
      });
      return;
    }

    // Insert point record
    const { error: pointError } = await supabase
      .from('referral_points')
      .insert({
        user_id: searchResult.id,
        points: points,
        source: 'admin_manual',
        description: manualReason
      });

    if (pointError) {
      toast({
        title: "Error",
        description: "Failed to award points",
        variant: "destructive"
      });
      return;
    }

    // Update balance
    const { error: balanceError } = await supabase
      .from('referral_point_balances')
      .upsert({
        user_id: searchResult.id,
        total_points: searchResult.total_points + points
      });

    if (balanceError) {
      toast({
        title: "Error",
        description: "Failed to update balance",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: `${points > 0 ? 'Awarded' : 'Deducted'} ${Math.abs(points)} points`,
    });

    setManualPoints('');
    setManualReason('');
    searchUser(); // Refresh data
    fetchReferralStats();
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
            <h1 className="text-xl font-bold">Referral Management</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Codes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_codes || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_points_awarded || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Referrals</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_referrals || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.active_referrals || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Top Referrers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Referrals</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topReferrers.map((referrer) => (
                    <TableRow key={referrer.user_id}>
                      <TableCell className="font-medium">{referrer.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{referrer.referral_code}</Badge>
                      </TableCell>
                      <TableCell>{referrer.total_referrals}</TableCell>
                      <TableCell>{referrer.active_referrals}</TableCell>
                      <TableCell className="font-semibold">{referrer.total_points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Manual Point Management */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Point Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search user by email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUser()}
              />
              <Button onClick={searchUser}>
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {searchResult && (
              <div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="font-medium">{searchResult.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Referral Code</Label>
                    <p className="font-medium">{searchResult.referral_code}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Points</Label>
                    <p className="text-lg font-bold">{searchResult.total_points}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Award/Deduct Points</Label>
                  <Input
                    type="number"
                    placeholder="Points (use negative to deduct)"
                    value={manualPoints}
                    onChange={(e) => setManualPoints(e.target.value)}
                  />
                  <Input
                    placeholder="Reason (required)"
                    value={manualReason}
                    onChange={(e) => setManualReason(e.target.value)}
                  />
                  <Button onClick={awardPoints} className="w-full">
                    Apply Points
                  </Button>
                </div>

                {searchResult.point_history?.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Recent History</Label>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {searchResult.point_history.map((record: any) => (
                        <div key={record.id} className="flex justify-between text-sm p-2 rounded bg-muted/10">
                          <span className="text-muted-foreground">
                            {new Date(record.earned_at).toLocaleDateString()}
                          </span>
                          <span>{record.description || record.source}</span>
                          <span className={`font-semibold ${record.points > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {record.points > 0 ? '+' : ''}{record.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default AdminReferrals;
