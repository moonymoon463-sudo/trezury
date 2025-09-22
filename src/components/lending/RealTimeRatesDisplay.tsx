import { useEffect, useState } from "react";
import { useRealTimeLending } from "@/hooks/useRealTimeLending";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function RealTimeRatesDisplay() {
  const { realTimeRates, getAssetRate } = useRealTimeLending();
  const [priceChanges, setPriceChanges] = useState<Record<string, number>>({});

  // Track rate changes for animations
  useEffect(() => {
    const changes: Record<string, number> = {};
    realTimeRates.forEach(rate => {
      const key = `${rate.asset}-${rate.chain}`;
      const prevRate = priceChanges[key];
      if (prevRate && prevRate !== rate.supplyRate) {
        changes[key] = rate.supplyRate > prevRate ? 1 : -1;
      } else {
        changes[key] = rate.supplyRate;
      }
    });
    setPriceChanges(changes);
  }, [realTimeRates]);

  const featuredAssets = ['XAUT', 'USDC', 'DAI', 'AURU'];

  return (
    <Card className="bg-[#2C2C2E] border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-yellow-400" />
            Live Rates
          </CardTitle>
          <Badge variant="outline" className="border-green-400 text-green-400">
            Real-time
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {featuredAssets.map(asset => {
          const rate = getAssetRate(asset);
          const changeDirection = priceChanges[`${asset}-ethereum`];
          
          return (
            <div key={asset} className="flex items-center justify-between p-3 bg-[#1C1C1E] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                  <span className="text-xs font-bold text-black">
                    {asset === 'XAUT' ? '🥇' : asset.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{asset}</p>
                  <p className="text-gray-400 text-xs">
                    {asset === 'XAUT' ? 'Tether Gold' :
                     asset === 'USDC' ? 'USD Coin' :
                     asset === 'DAI' ? 'MakerDAO' :
                     asset === 'AURU' ? 'Aurum Token' : asset}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">
                    {rate ? `${(rate.supplyRate * 100).toFixed(2)}%` : '–'}
                  </span>
                  {typeof changeDirection === 'number' && changeDirection !== 0 && (
                    <div className={`p-1 rounded ${
                      changeDirection > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {changeDirection > 0 ? 
                        <TrendingUp className="h-3 w-3" /> : 
                        <TrendingDown className="h-3 w-3" />
                      }
                    </div>
                  )}
                </div>
                <p className="text-gray-400 text-xs">
                  Supply APY
                </p>
                {rate && (
                  <p className="text-gray-500 text-xs">
                    {(rate.utilization * 100).toFixed(1)}% utilized
                  </p>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="text-center pt-2">
          <p className="text-gray-500 text-xs">
            Rates update every 30 seconds based on utilization
          </p>
        </div>
      </CardContent>
    </Card>
  );
}