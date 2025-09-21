import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLendingOperations, PoolAsset } from "@/hooks/useLendingOperations";
import { useEffect } from "react";

interface LendingMarketsProps {
  onSupply: (asset: PoolAsset) => void;
  onBorrow: (asset: PoolAsset) => void;
}

export function LendingMarkets({ onSupply, onBorrow }: LendingMarketsProps) {
  const { poolAssets, fetchPoolAssets } = useLendingOperations();

  useEffect(() => {
    fetchPoolAssets();
  }, []);

  const formatApy = (apy: number) => `${(apy * 100).toFixed(2)}%`;
  const formatAmount = (amount: number) => `${amount.toLocaleString()}`;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Available Markets</h3>
      
      <div className="grid gap-4">
        {poolAssets.map((asset) => (
          <Card key={`${asset.asset}-${asset.chain}`} className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{asset.asset}</span>
                  <span className="text-sm text-muted-foreground">{asset.chain}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Available</div>
                  <div className="text-foreground">{formatAmount(asset.available)}</div>
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Supply APY</div>
                  <div className="text-lg text-primary">{formatApy(asset.supplyApy)}</div>
                  <Button 
                    onClick={() => onSupply(asset)}
                    className="w-full"
                    variant="default"
                  >
                    Supply
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Borrow APY</div>
                  <div className="text-lg text-destructive">{formatApy(asset.borrowApy)}</div>
                  <Button 
                    onClick={() => onBorrow(asset)}
                    className="w-full"
                    variant="outline"
                  >
                    Borrow
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}