import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import type { Market01 } from '@/hooks/use01Markets';

interface O1MarketListProps {
  markets: Market01[];
  selectedMarket: string;
  onSelectMarket: (symbol: string) => void;
  loading?: boolean;
  error?: string | null;
}

export const O1MarketList = ({
  markets,
  selectedMarket,
  onSelectMarket,
  loading,
  error,
}: O1MarketListProps) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 text-destructive">
        <AlertTriangle className="h-4 w-4 mr-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <span className="text-sm">No markets available</span>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1">
        {markets.map((market) => {
          const isSelected = market.symbol === selectedMarket;
          const isPriceUp = market.change24h >= 0;

          return (
            <button
              key={market.symbol}
              onClick={() => onSelectMarket(market.symbol)}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                isSelected
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-card/50 border border-transparent hover:bg-card/80'
              }`}
            >
              {/* Market Symbol */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {market.symbol}
                </span>
                {isPriceUp ? (
                  <TrendingUp className={`h-3 w-3 ${isSelected ? 'text-primary' : 'text-status-success'}`} />
                ) : (
                  <TrendingDown className={`h-3 w-3 ${isSelected ? 'text-primary' : 'text-status-error'}`} />
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-foreground text-sm font-medium">
                  ${market.markPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    isPriceUp ? 'text-status-success' : 'text-status-error'
                  }`}
                >
                  {isPriceUp ? '+' : ''}{market.change24h.toFixed(2)}%
                </span>
              </div>

              {/* 24h Volume & Funding */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Vol: ${(market.volume24h / 1000000).toFixed(1)}M
                </span>
                <span className="text-muted-foreground">
                  {market.fundingRate >= 0 ? '+' : ''}{(market.fundingRate * 100).toFixed(4)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
};
