import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Loader2, X } from 'lucide-react';
import { use01Trading } from '@/hooks/use01Trading';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mock positions for now
const mockPositions = [
  {
    market: 'SOL-PERP',
    side: 'long' as const,
    size: 10,
    entryPrice: 180,
    markPrice: 185,
    leverage: 10,
    unrealizedPnl: 50,
    pnlPercent: 2.78,
  },
];

export const O1PositionsTable = () => {
  const { closePosition, loading } = use01Trading();
  const { toast } = useToast();
  const [positions] = useState(mockPositions);
  const [closingMarket, setClosingMarket] = useState<string | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<typeof mockPositions[0] | null>(null);
  const [password, setPassword] = useState('');

  const handleOpenCloseDialog = (position: typeof mockPositions[0]) => {
    setSelectedPosition(position);
    setShowCloseDialog(true);
  };

  const handleClosePosition = async () => {
    if (!selectedPosition || !password) {
      toast({
        variant: 'destructive',
        title: 'Password Required',
        description: 'Please enter your wallet password',
      });
      return;
    }

    setShowCloseDialog(false);
    setClosingMarket(selectedPosition.market);

    const result = await closePosition({ market: selectedPosition.market }, password);

    setClosingMarket(null);
    setPassword('');

    if (result.ok) {
      // Position closed successfully - toast already shown by hook
    }
  };

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-muted-foreground text-sm">No open positions</p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Open a position to start trading
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-3">
          {positions.map((position) => {
            const isProfit = position.unrealizedPnl > 0;
            const isClosing = closingMarket === position.market;

            return (
              <Card
                key={position.market}
                className="bg-card/50 border-border/40 hover:bg-card/60 transition-colors"
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-semibold">{position.market}</span>
                      <Badge
                        variant={position.side === 'long' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {position.side.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {position.leverage}x
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenCloseDialog(position)}
                      disabled={isClosing || loading}
                      className="h-7 px-2"
                    >
                      {isClosing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Size</div>
                      <div className="text-sm font-medium text-foreground">
                        {position.size.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Entry</div>
                      <div className="text-sm font-medium text-foreground">
                        ${position.entryPrice.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Mark</div>
                      <div className="text-sm font-medium text-foreground">
                        ${position.markPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  {/* P&L */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Unrealized P&L</div>
                    <div
                      className={`flex items-center gap-2 font-semibold ${
                        isProfit ? 'text-status-success' : 'text-status-error'
                      }`}
                    >
                      {isProfit ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span>
                        {isProfit ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                      </span>
                      <span className="text-sm opacity-70">
                        ({isProfit ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Close Position Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Position</DialogTitle>
            <DialogDescription>
              Enter your password to close your {selectedPosition?.market} position
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="close-password">Wallet Password</Label>
              <Input
                id="close-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleClosePosition();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleClosePosition} disabled={!password}>
              Close Position
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
