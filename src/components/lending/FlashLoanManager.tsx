import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Zap, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface FlashLoanOpportunity {
  id: string;
  type: 'arbitrage' | 'liquidation' | 'refinance';
  asset: string;
  amount: number;
  estimatedProfit: number;
  gasEstimate: number;
  riskLevel: 'low' | 'medium' | 'high';
  protocols: string[];
}

export function FlashLoanManager() {
  const { toast } = useToast();
  const [opportunities, setOpportunities] = useState<FlashLoanOpportunity[]>([
    {
      id: '1',
      type: 'arbitrage',
      asset: 'USDC',
      amount: 50000,
      estimatedProfit: 125.50,
      gasEstimate: 0.02,
      riskLevel: 'low',
      protocols: ['Aave', 'Compound']
    },
    {
      id: '2',
      type: 'liquidation',
      asset: 'ETH',
      amount: 25,
      estimatedProfit: 892.30,
      gasEstimate: 0.05,
      riskLevel: 'medium',
      protocols: ['Aave', 'MakerDAO']
    }
  ]);

  const [customAmount, setCustomAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('USDC');
  const [isExecuting, setIsExecuting] = useState(false);

  const executeFlashLoan = async (opportunity: FlashLoanOpportunity) => {
    setIsExecuting(true);
    try {
      // Simulate flash loan execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Flash Loan Executed",
        description: `Successfully executed ${opportunity.type} flash loan for ${opportunity.estimatedProfit.toFixed(2)} USDC profit`,
      });
      
      // Remove executed opportunity
      setOpportunities(prev => prev.filter(op => op.id !== opportunity.id));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Flash Loan Failed",
        description: "Failed to execute flash loan. Please try again.",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const createCustomFlashLoan = async () => {
    if (!customAmount || parseFloat(customAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid amount for the flash loan",
      });
      return;
    }

    setIsExecuting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Custom Flash Loan Created",
        description: `Custom flash loan strategy created for ${customAmount} ${selectedAsset}`,
      });
      
      setCustomAmount('');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to Create",
        description: "Failed to create custom flash loan strategy",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'arbitrage': return <TrendingUp className="w-4 h-4" />;
      case 'liquidation': return <AlertTriangle className="w-4 h-4" />;
      case 'refinance': return <CheckCircle className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Zap className="w-5 h-5 text-primary" />
            Flash Loan Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {opportunities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No profitable opportunities available right now</p>
              <p className="text-sm">Check back later or create a custom strategy</p>
            </div>
          ) : (
            opportunities.map((opportunity) => (
              <Card key={opportunity.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(opportunity.type)}
                      <span className="font-medium text-white capitalize">
                        {opportunity.type}
                      </span>
                      <Badge variant="outline" className={getRiskColor(opportunity.riskLevel)}>
                        {opportunity.riskLevel} risk
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-medium">
                        +${opportunity.estimatedProfit.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Gas: ~${opportunity.gasEstimate.toFixed(3)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-gray-400">Amount</div>
                      <div className="text-white">
                        {opportunity.amount.toLocaleString()} {opportunity.asset}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Protocols</div>
                      <div className="text-white">
                        {opportunity.protocols.join(' → ')}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => executeFlashLoan(opportunity)}
                    disabled={isExecuting}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {isExecuting ? 'Executing...' : 'Execute Flash Loan'}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Custom Flash Loan Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount" className="text-gray-300">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="asset" className="text-gray-300">Asset</Label>
              <select
                id="asset"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white"
              >
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
                <option value="WBTC">WBTC</option>
                <option value="DAI">DAI</option>
              </select>
            </div>
          </div>
          
          <Button
            onClick={createCustomFlashLoan}
            disabled={isExecuting || !customAmount}
            variant="outline"
            className="w-full"
          >
            {isExecuting ? 'Creating...' : 'Create Custom Strategy'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}