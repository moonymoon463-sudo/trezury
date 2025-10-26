import { Button } from '@/components/ui/button';
import { Minus, TrendingUp, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DrawingMode } from '@/hooks/useChartDrawingTools';

interface ChartDrawingToolsProps {
  drawingMode: DrawingMode;
  onDrawingModeChange: (mode: DrawingMode) => void;
  activeIndicators: Set<string>;
  onToggleIndicator: (indicator: string) => void;
  onClearAll: () => void;
  disabled?: boolean;
}

const INDICATORS = [
  { id: 'MA20', label: 'Moving Average (20)', color: '#3B82F6' },
  { id: 'MA50', label: 'Moving Average (50)', color: '#A855F7' },
  { id: 'MA200', label: 'Moving Average (200)', color: '#EF4444' },
];

export function ChartDrawingTools({
  drawingMode,
  onDrawingModeChange,
  activeIndicators,
  onToggleIndicator,
  onClearAll,
  disabled = false,
}: ChartDrawingToolsProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-md p-1 shadow-xl">
        {/* Drawing Tools */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => onDrawingModeChange('trendline')}
              className={cn(
                'h-7 w-7 rounded-sm',
                drawingMode === 'trendline'
                  ? 'text-aurum bg-aurum/10 hover:bg-aurum/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )}
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Trend Line</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => onDrawingModeChange('horizontal')}
              className={cn(
                'h-7 w-7 rounded-sm',
                drawingMode === 'horizontal'
                  ? 'text-aurum bg-aurum/10 hover:bg-aurum/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Horizontal Line</TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-px h-4 bg-white/10 mx-0.5" />

        {/* Indicators */}
        {INDICATORS.map((indicator) => (
          <Tooltip key={indicator.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => onToggleIndicator(indicator.id)}
                className={cn(
                  'h-7 w-7 rounded-sm',
                  activeIndicators.has(indicator.id)
                    ? 'bg-white/10 hover:bg-white/15'
                    : 'hover:bg-white/5'
                )}
              >
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: indicator.color }}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{indicator.label}</TooltipContent>
          </Tooltip>
        ))}

        {/* Divider */}
        <div className="w-px h-4 bg-white/10 mx-0.5" />

        {/* Clear All */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={onClearAll}
              className="h-7 w-7 rounded-sm text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear All</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
