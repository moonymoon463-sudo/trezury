import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, Users, TrendingUp, Zap } from "lucide-react";

interface TestDataResults {
  supplies_created: number;
  borrows_created: number;
  users_populated: number;
  flash_loans_created: number;
  liquidation_auctions_created: number;
}

export const TestDataSeeder = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [results, setResults] = useState<TestDataResults | null>(null);
  const { toast } = useToast();

  const handleSeedData = async () => {
    try {
      setIsSeeding(true);
      setResults(null);

      const { data, error } = await supabase.functions.invoke('populate-test-data');

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data.results);
      
      toast({
        title: "Test Data Created Successfully",
        description: `Populated ${data.results.users_populated} users with realistic positions`,
      });

    } catch (error: any) {
      console.error('Test data seeding failed:', error);
      toast({
        title: "Seeding Failed",
        description: error.message || "Failed to create test data",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Test Data Seeder
        </CardTitle>
        <CardDescription>
          Populate the lending platform with realistic test data including user positions, 
          flash loan opportunities, and liquidation auctions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleSeedData} 
          disabled={isSeeding} 
          className="w-full"
          size="lg"
        >
          {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSeeding ? "Seeding Test Data..." : "Seed Test Data"}
        </Button>

        {results && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Users</span>
              <Badge variant="secondary">{results.users_populated}</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm">Supplies</span>
              <Badge variant="secondary">{results.supplies_created}</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span className="text-sm">Borrows</span>
              <Badge variant="secondary">{results.borrows_created}</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Flash Loans</span>
              <Badge variant="secondary">{results.flash_loans_created}</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Auctions</span>
              <Badge variant="secondary">{results.liquidation_auctions_created}</Badge>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Test Scenarios Created:</strong></p>
          <ul className="space-y-1 ml-4">
            <li>• Conservative Supplier (USDC/USDT supplies)</li>
            <li>• Leveraged Gold Trader (XAUT + leveraged positions)</li>
            <li>• DeFi Power User (AURU governance + complex borrows)</li>
            <li>• Yield Farmer (Multi-chain large positions)</li>
            <li>• High Risk Trader (Highly leveraged positions)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};