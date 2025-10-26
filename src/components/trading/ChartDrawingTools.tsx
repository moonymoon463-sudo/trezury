import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Minus, TrendingUp, Trash2 } from 'lucide-react';
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
  { id: 'MA20', label: 'MA20', color: 'hsl(var(--chart-1))' },
  { id: 'MA50', label: 'MA50', color: 'hsl(var(--chart-2))' },
  { id: 'MA200', label: 'MA200', color: 'hsl(var(--chart-3))' },
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
    <div className="flex items-center gap-2 flex-wrap p-2 bg-black/40 border border-aurum/20 rounded-lg backdrop-blur-sm">
      {/* Drawing Tools */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground mr-1">Draw:</span>
        <Button
          variant={drawingMode === 'trendline' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDrawingModeChange('trendline')}
          disabled={disabled}
          className={
            drawingMode === 'trendline'
              ? 'bg-aurum text-black hover:bg-aurum-glow h-7 text-xs'
              : 'border-aurum/20 text-aurum hover:bg-aurum/10 h-7 text-xs'
          }
          title="Draw Trend Line"
        >
          <TrendingUp className="h-3 w-3 mr-1" />
          Trend Line
        </Button>
        <Button
          variant={drawingMode === 'horizontal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDrawingModeChange('horizontal')}
          disabled={disabled}
          className={
            drawingMode === 'horizontal'
              ? 'bg-aurum text-black hover:bg-aurum-glow h-7 text-xs'
              : 'border-aurum/20 text-aurum hover:bg-aurum/10 h-7 text-xs'
          }
          title="Draw Horizontal Line"
        >
          <Minus className="h-3 w-3 mr-1" />
          Horizontal
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 bg-aurum/20" />

      {/* Indicators */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground mr-1">Indicators:</span>
        {INDICATORS.map((indicator) => (
          <Button
            key={indicator.id}
            variant={activeIndicators.has(indicator.id) ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggleIndicator(indicator.id)}
            disabled={disabled}
            className={
              activeIndicators.has(indicator.id)
                ? 'bg-aurum text-black hover:bg-aurum-glow h-7 text-xs'
                : 'border-aurum/20 text-aurum hover:bg-aurum/10 h-7 text-xs'
            }
            title={`Toggle ${indicator.label}`}
          >
            <div 
              className="w-2 h-2 rounded-full mr-1" 
              style={{ backgroundColor: indicator.color }}
            />
            {indicator.label}
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6 bg-aurum/20" />

      {/* Clear All */}
      <Button
        variant="outline"
        size="sm"
        onClick={onClearAll}
        disabled={disabled}
        className="border-red-500/20 text-red-500 hover:bg-red-500/10 h-7 text-xs"
        title="Clear All Drawings"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Clear All
      </Button>
    </div>
  );
}
