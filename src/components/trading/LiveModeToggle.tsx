import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LiveModeToggleProps {
  isLive: boolean;
  onToggle: () => void;
}

export const LiveModeToggle = ({ isLive, onToggle }: LiveModeToggleProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 px-2 gap-1.5"
          >
            {isLive ? (
              <>
                <Badge variant="default" className="h-5 px-1.5 gap-1 bg-green-500 hover:bg-green-600">
                  <Play className="h-3 w-3 fill-current" />
                  <span className="text-[10px] font-medium">LIVE</span>
                </Badge>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="h-5 px-1.5 gap-1">
                  <Pause className="h-3 w-3" />
                  <span className="text-[10px] font-medium">PAUSED</span>
                </Badge>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>{isLive ? 'Chart is auto-updating with live data' : 'Chart updates paused - scroll freely'}</p>
          <p className="text-muted-foreground mt-1">Click to {isLive ? 'pause' : 'resume'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
