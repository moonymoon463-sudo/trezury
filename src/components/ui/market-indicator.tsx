import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MarketIndicatorProps {
  title: string;
  value: string;
  change: number;
  percentage: number;
  period?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const MarketIndicator = ({
  title,
  value,
  change,
  percentage,
  period = '24h',
  icon,
  className
}: MarketIndicatorProps) => {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  
  return (
    <Card className={cn("border-border/50", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
            isPositive && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            isNegative && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            isNeutral && "bg-muted text-muted-foreground"
          )}>
            <TrendIcon className="w-3 h-3" />
            {period}
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="text-2xl font-semibold text-foreground">
            {value}
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(
              "font-medium",
              isPositive && "text-green-600 dark:text-green-400",
              isNegative && "text-red-600 dark:text-red-400",
              isNeutral && "text-muted-foreground"
            )}>
              {isPositive && '+'}{change.toFixed(2)}
            </span>
            
            <span className={cn(
              "font-medium",
              isPositive && "text-green-600 dark:text-green-400",
              isNegative && "text-red-600 dark:text-red-400", 
              isNeutral && "text-muted-foreground"
            )}>
              ({isPositive && '+'}{percentage.toFixed(2)}%)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketIndicator;