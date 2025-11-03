import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useHyperliquidFunding } from '@/hooks/useHyperliquidFunding';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface FundingRateDisplayProps {
  market: string;
}

export const FundingRateDisplay = ({ market }: FundingRateDisplayProps) => {
  const { fundingRate, nextFundingTime, annualizedRate, formatTimeUntil, loading, error } = useHyperliquidFunding(market);

  if (loading) {
    return (
      <Badge variant="outline" className="text-xs h-6 px-2">
        <div className="animate-pulse">Loading...</div>
      </Badge>
    );
  }

  if (error || fundingRate === 0) {
    return null;
  }

  const isPositive = fundingRate > 0;
  const fundingPercent = (fundingRate * 100).toFixed(4);
  const annualizedPercent = (annualizedRate * 100).toFixed(2);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={isPositive ? 'default' : 'destructive'}
            className="text-xs h-6 px-2 gap-1 cursor-help"
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>Funding: {isPositive ? '+' : ''}{fundingPercent}%</span>
            {nextFundingTime && (
              <>
                <Clock className="h-3 w-3 ml-1" />
                <span className="text-[10px]">{formatTimeUntil(nextFundingTime)}</span>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p><strong>Current Funding Rate:</strong> {isPositive ? '+' : ''}{fundingPercent}%</p>
            <p><strong>Annualized:</strong> {isPositive ? '+' : ''}{annualizedPercent}%</p>
            {nextFundingTime && (
              <p><strong>Next Payment:</strong> in {formatTimeUntil(nextFundingTime)}</p>
            )}
            <p className="text-muted-foreground mt-2">
              {isPositive 
                ? 'Longs pay shorts (bullish sentiment)'
                : 'Shorts pay longs (bearish sentiment)'}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
