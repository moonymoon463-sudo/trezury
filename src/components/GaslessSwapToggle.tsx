import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GaslessSwapToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  estimatedFee?: string;
  estimatedFeeUSD?: string;
}

export const GaslessSwapToggle = ({ 
  enabled, 
  onToggle, 
  estimatedFee,
  estimatedFeeUSD 
}: GaslessSwapToggleProps) => {
  return (
    <div className="flex items-center justify-between p-4 bg-accent/20 rounded-lg mb-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="gasless-mode" className="text-white">Gasless Swap</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Pay fees from your output tokens instead of ETH</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="flex items-center gap-3">
        {enabled && estimatedFee && (
          <span className="text-sm text-muted-foreground">
            Fee: {estimatedFee} ({estimatedFeeUSD})
          </span>
        )}
        <Switch
          id="gasless-mode"
          checked={enabled}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  );
};
