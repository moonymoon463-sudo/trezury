import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { dydxTradingService } from '@/services/dydxTradingService';
import { dydxRiskManager } from '@/services/dydxRiskManager';
import type { DydxPositionDB } from '@/types/dydx-trading';
import { TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';

interface PositionManagerProps {
  address?: string;
  currentPrices: Record<string, number>;
}

export const PositionManager: React.FC<PositionManagerProps> = ({ address, currentPrices }) => {
  const [positions, setPositions] = useState<DydxPositionDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const { toast } = useToast();
  const { getPassword } = useTradingPasswordContext();

  useEffect(() => {
    if (!address) return;

    const loadPositions = async () => {
      setLoading(true);
      try {
        const data = await dydxTradingService.getOpenPositions(address);
        setPositions(data);
      } catch (error) {
        console.error('[PositionManager] Failed to load:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPositions();
    const interval = setInterval(loadPositions, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [address]);

  const handleClosePosition = async (market: string) => {
    const password = getPassword();
    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Session Locked',
        description: 'Please unlock your trading session first'
      });
      return;
    }

    setClosingPosition(market);
    try {
      const response = await dydxTradingService.closePosition(market, password);
      if (response.success) {
        toast({
          title: 'Position Closed',
          description: `Successfully closed ${market} position`
        });
        // Reload positions
        if (address) {
          const data = await dydxTradingService.getOpenPositions(address);
          setPositions(data);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Close',
          description: response.error
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setClosingPosition(null);
    }
  };

  const PositionRow = ({ position }: { position: DydxPositionDB }) => {
    const currentPrice = currentPrices[position.market] || position.entry_price;
    const pnl = position.side === 'LONG'
      ? (currentPrice - position.entry_price) * position.size
      : (position.entry_price - currentPrice) * position.size;
    
    const pnlPercent = ((currentPrice - position.entry_price) / position.entry_price) * 100 * (position.side === 'LONG' ? 1 : -1);
    const isProfit = pnl > 0;

    const risk = dydxRiskManager.assessPositionRisk(position, currentPrice);
    const riskColors = {
      low: 'bg-green-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      critical: 'bg-red-500'
    };

    return (
      <div className="border border-border rounded-lg p-4 mb-3 bg-card">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-lg text-foreground">{position.market}</span>
              <Badge variant={position.side === 'LONG' ? 'default' : 'destructive'}>
                {position.side} {position.leverage}x
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Size: {position.size} @ ${position.entry_price.toFixed(2)}
            </p>
          </div>
          
          <div className="text-right">
            <div className={`flex items-center gap-1 text-lg font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
              {isProfit ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {isProfit ? '+' : ''}${pnl.toFixed(2)}
            </div>
            <p className={`text-sm ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
              {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Price:</span>
            <span className="font-medium text-foreground">${currentPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Liquidation Price:</span>
            <span className="font-medium text-foreground">${position.liquidation_price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted-foreground">Distance to Liquidation:</span>
            <span className="font-medium text-foreground">{risk.distanceToLiquidation.toFixed(1)}%</span>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Risk Level:</span>
              <span className={`font-medium uppercase ${risk.riskLevel === 'critical' ? 'text-red-500' : risk.riskLevel === 'high' ? 'text-orange-500' : risk.riskLevel === 'medium' ? 'text-yellow-500' : 'text-green-500'}`}>
                {risk.riskLevel}
              </span>
            </div>
            <Progress value={risk.distanceToLiquidation} className="h-2" />
          </div>
        </div>

        {risk.recommendedAction && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2 mb-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-500">{risk.recommendedAction}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleClosePosition(position.market)}
            disabled={closingPosition === position.market}
            className="flex-1"
          >
            {closingPosition === position.market ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Closing...
              </>
            ) : (
              'Close Position'
            )}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          <span>Open Positions</span>
          <Badge variant="outline">{positions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No open positions</p>
        ) : (
          <div className="space-y-2">
            {positions.map(position => (
              <PositionRow key={position.id} position={position} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
