import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Database, Trash2, BarChart3 } from 'lucide-react';

const TestDataManager = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const { toast } = useToast();

  const handleGenerateTestData = async () => {
    setLoading(true);
    try {
      // Lending functionality removed - test data no longer needed
      toast({
        title: "Feature Removed",
        description: "Test data generation is no longer available"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearTestData = async () => {
    // No-op - test data functionality removed
    toast({
      title: "Feature Removed",
      description: "Test data clearing is no longer available"
    });
  };

  const loadStats = async () => {
    // No-op - test data functionality removed
    setStats({
      total: 0,
      pending: 0,
      completed: 0,
      failed: 0,
      by_chain: {},
      total_amount: 0
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Test Data Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button 
            onClick={handleGenerateTestData}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            {loading ? 'Generating...' : 'Generate Test Data'}
          </Button>
          
          <Button 
            onClick={handleClearTestData}
            disabled={loading}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Test Data
          </Button>
          
          <Button 
            onClick={loadStats}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Load Stats
          </Button>
        </div>

        {stats && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_chain).map(([chain, count]: [string, any]) => (
                <Badge key={chain} variant="outline">
                  {chain}: {count}
                </Badge>
              ))}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Total Amount: ${stats.total_amount.toFixed(2)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestDataManager;