import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Zap, Clock, Target } from 'lucide-react';

interface YieldStrategy {
  id: string;
  name: string;
  protocol: string;
  baseAPY: number;
  rewardAPY: number;
  totalAPY: number;
  tvl: number;
  riskLevel: 'low' | 'medium' | 'high';
  assets: string[];
  description: string;
  isActive?: boolean;
  userStake?: number;
}

export function YieldFarmingHub() {
  const { toast } = useToast();
  const [strategies, setStrategies] = useState<YieldStrategy[]>([
    {
      id: '1',
      name: 'USDC-ETH LP Farming',
      protocol: 'Uniswap V3',
      baseAPY: 12.5,
      rewardAPY: 8.3,
      totalAPY: 20.8,
      tvl: 45600000,
      riskLevel: 'medium',
      assets: ['USDC', 'ETH'],
      description: 'Provide liquidity to USDC-ETH pair and earn trading fees plus UNI rewards',
      isActive: true,
      userStake: 5000
    },
    {
      id: '2',
      name: 'Stable Coin Vault',
      protocol: 'Yearn Finance',
      baseAPY: 8.7,
      rewardAPY: 3.2,
      totalAPY: 11.9,
      tvl: 120000000,
      riskLevel: 'low',
      assets: ['USDC', 'DAI', 'USDT'],
      description: 'Auto-compounding stable coin strategy with multiple yield sources',
      isActive: false
    },
    {
      id: '3',
      name: 'Convex Curve Boost',
      protocol: 'Convex',
      baseAPY: 15.2,
      rewardAPY: 12.8,
      totalAPY: 28.0,
      tvl: 85000000,
      riskLevel: 'high',
      assets: ['CRV', 'CVX'],
      description: 'Boosted Curve pool rewards with Convex multipliers',
      isActive: false
    }
  ]);

  const [selectedStrategy, setSelectedStrategy] = useState<YieldStrategy | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');

  const enterStrategy = async (strategy: YieldStrategy) => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid stake amount",
      });
      return;
    }

    try {
      // Simulate strategy entry
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStrategies(prev => prev.map(s => 
        s.id === strategy.id 
          ? { ...s, isActive: true, userStake: parseFloat(stakeAmount) }
          : s
      ));
      
      toast({
        title: "Strategy Activated",
        description: `Successfully entered ${strategy.name} with ${stakeAmount} USD`,
      });
      
      setSelectedStrategy(null);
      setStakeAmount('');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Strategy Entry Failed",
        description: "Failed to enter yield farming strategy",
      });
    }
  };

  const exitStrategy = async (strategy: YieldStrategy) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStrategies(prev => prev.map(s => 
        s.id === strategy.id 
          ? { ...s, isActive: false, userStake: undefined }
          : s
      ));
      
      toast({
        title: "Strategy Exited",
        description: `Successfully exited ${strategy.name}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Exit Failed",
        description: "Failed to exit yield farming strategy",
      });
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'high': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatTVL = (tvl: number) => {
    if (tvl >= 1000000000) return `$${(tvl / 1000000000).toFixed(1)}B`;
    if (tvl >= 1000000) return `$${(tvl / 1000000).toFixed(1)}M`;
    if (tvl >= 1000) return `$${(tvl / 1000).toFixed(1)}K`;
    return `$${tvl}`;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-primary" />
            Yield Farming Strategies
          </CardTitle>
          <p className="text-gray-400">
            Maximize your yields with automated compound strategies
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {strategies.map((strategy) => (
            <Card key={strategy.id} className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-white">{strategy.name}</h3>
                    <p className="text-sm text-gray-400">{strategy.protocol}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold text-lg">
                      {strategy.totalAPY.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-400">Total APY</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-gray-400">Base APY</div>
                    <div className="text-white">{strategy.baseAPY.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Reward APY</div>
                    <div className="text-primary">{strategy.rewardAPY.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-400">TVL</div>
                    <div className="text-white">{formatTVL(strategy.tvl)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Risk Level</div>
                    <Badge className={getRiskColor(strategy.riskLevel)}>
                      {strategy.riskLevel}
                    </Badge>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-gray-400 text-sm mb-2">Assets:</div>
                  <div className="flex gap-2">
                    {strategy.assets.map((asset) => (
                      <Badge key={asset} variant="outline" className="text-xs">
                        {asset}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <p className="text-sm text-gray-400 mb-4">{strategy.description}</p>
                
                {strategy.isActive && strategy.userStake ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-500/20 rounded-lg">
                      <div>
                        <div className="text-green-400 font-medium">Active Position</div>
                        <div className="text-white">${strategy.userStake.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400">Daily Rewards</div>
                        <div className="text-white">
                          ${((strategy.userStake * strategy.totalAPY / 100) / 365).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => exitStrategy(strategy)}
                      variant="outline"
                      className="w-full"
                    >
                      Exit Strategy
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setSelectedStrategy(strategy)}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    Enter Strategy
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {selectedStrategy && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Enter {selectedStrategy.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Strategy Details:</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Expected APY:</span>
                  <span className="text-green-400">{selectedStrategy.totalAPY.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Risk Level:</span>
                  <Badge className={getRiskColor(selectedStrategy.riskLevel)}>
                    {selectedStrategy.riskLevel}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Lock Period:</span>
                  <span className="text-white">None (withdraw anytime)</span>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="stakeAmount" className="text-gray-300 text-sm">
                Stake Amount (USD)
              </label>
              <input
                id="stakeAmount"
                type="number"
                placeholder="Enter amount to stake"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full mt-1 p-3 rounded-md bg-gray-800 border border-gray-700 text-white placeholder-gray-400"
              />
            </div>
            
            {stakeAmount && parseFloat(stakeAmount) > 0 && (
              <div className="p-3 bg-green-500/20 rounded-lg text-sm">
                <div className="text-green-400">Projected Daily Earnings:</div>
                <div className="text-white font-medium">
                  ${((parseFloat(stakeAmount) * selectedStrategy.totalAPY / 100) / 365).toFixed(2)}
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={() => setSelectedStrategy(null)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => enterStrategy(selectedStrategy)}
                disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Enter Strategy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}