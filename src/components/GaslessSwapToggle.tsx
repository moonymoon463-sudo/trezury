import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GaslessSwapToggleProps {
  estimatedFee?: string;
  estimatedFeeUSD?: string;
}

export const GaslessSwapToggle = ({ 
  estimatedFee,
  estimatedFeeUSD 
}: GaslessSwapToggleProps) => {
  return (
    <Alert className="mb-4 bg-primary/10 border-primary/20">
      <Info className="h-4 w-4" />
      <AlertDescription className="ml-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">Gas fees paid from output tokens</span>
          {estimatedFee && estimatedFeeUSD && (
            <span className="text-sm font-medium">
              ~{estimatedFee} (${estimatedFeeUSD})
            </span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
