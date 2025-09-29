import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFinancialDataCollection } from '@/hooks/useFinancialDataCollection';
import { supabase } from '@/integrations/supabase/client';

export const TestDataTrigger = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { triggerNewsCollection, loading: newsLoading } = useFinancialDataCollection();

  const addTestPortfolioData = async () => {
    try {
      setLoading(true);
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to add test portfolio data",
          variant: "destructive",
        });
        return;
      }

      // Add test balance snapshots
      const testBalances = [
        { asset: 'USDC', amount: 10000.00, hours_ago: 1 },
        { asset: 'XAUT', amount: 2.5, hours_ago: 0.5 },
        { asset: 'TRZRY', amount: 1500.00, hours_ago: 0.25 },
        // Historical data
        { asset: 'USDC', amount: 12000.00, hours_ago: 24 },
        { asset: 'XAUT', amount: 2.0, hours_ago: 24 },
        { asset: 'TRZRY', amount: 1200.00, hours_ago: 24 },
        { asset: 'USDC', amount: 15000.00, hours_ago: 72 },
        { asset: 'XAUT', amount: 1.5, hours_ago: 72 },
        { asset: 'TRZRY', amount: 1000.00, hours_ago: 72 },
      ];

      for (const balance of testBalances) {
        const { error } = await supabase
          .from('balance_snapshots')
          .insert({
            user_id: user.id,
            asset: balance.asset,
            amount: balance.amount,
            snapshot_at: new Date(Date.now() - balance.hours_ago * 60 * 60 * 1000).toISOString()
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Test portfolio data added successfully",
      });

    } catch (error) {
      console.error('Failed to add test data:', error);
      toast({
        title: "Error",
        description: "Failed to add test portfolio data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Test Data Management</CardTitle>
        <CardDescription>
          Trigger financial news collection and add test portfolio data for AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={triggerNewsCollection}
            disabled={newsLoading}
            className="flex-1"
          >
            {newsLoading ? "Collecting News..." : "Trigger News Collection"}
          </Button>
          
          <Button 
            onClick={addTestPortfolioData}
            disabled={loading}
            variant="outline"
            className="flex-1"
          >
            {loading ? "Adding Data..." : "Add Test Portfolio Data"}
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>• News collection will populate the financial news database for AI context</p>
          <p>• Test portfolio data includes USDC, XAUT, and TRZRY balances with historical data</p>
          <p>• You must be signed in to add portfolio data</p>
        </div>
      </CardContent>
    </Card>
  );
};