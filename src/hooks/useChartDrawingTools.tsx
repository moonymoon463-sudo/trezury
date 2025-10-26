import { useState, useCallback } from 'react';

export type DrawingMode = 'none' | 'trendline' | 'horizontal';

export interface DrawnLine {
  id: string;
  type: 'horizontal' | 'trendline';
  price?: number;
  points?: { time: number; price: number }[];
  seriesRef?: any;
}

export function useChartDrawingTools() {
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([]);
  const [trendLineStart, setTrendLineStart] = useState<{ time: number; price: number } | null>(null);

  const toggleDrawingMode = useCallback((mode: DrawingMode) => {
    setDrawingMode(prev => prev === mode ? 'none' : mode);
    setTrendLineStart(null); // Reset trend line start when changing modes
  }, []);

  const toggleIndicator = useCallback((indicator: string) => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      if (next.has(indicator)) {
        next.delete(indicator);
      } else {
        next.add(indicator);
      }
      return next;
    });
  }, []);

  const addLine = useCallback((line: DrawnLine) => {
    setDrawnLines(prev => [...prev, line]);
  }, []);

  const removeLine = useCallback((id: string) => {
    setDrawnLines(prev => prev.filter(line => line.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setDrawnLines([]);
    setActiveIndicators(new Set());
    setDrawingMode('none');
    setTrendLineStart(null);
  }, []);

  return {
    drawingMode,
    activeIndicators,
    drawnLines,
    trendLineStart,
    toggleDrawingMode,
    toggleIndicator,
    addLine,
    removeLine,
    clearAll,
    setTrendLineStart,
  };
}
