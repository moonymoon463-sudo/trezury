import { useEffect, useRef, useState } from 'react';
// Note: We'll lazy-load lightweight-charts to avoid bundler interop issues
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DydxCandle } from '@/types/dydx';
import { Loader2 } from 'lucide-react';
import { SpiralOverlay } from '@/components/SpiralOverlay';
import { ChartDrawingTools } from './ChartDrawingTools';
import { useChartDrawingTools } from '@/hooks/useChartDrawingTools';
import { calculateSMA } from '@/utils/chartIndicators';

interface TradingViewChartProps {
  symbol: string;
  candles: DydxCandle[];
  resolution: string;
  onResolutionChange: (resolution: string) => void;
  loading?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  phase?: string;
}

const TIMEFRAMES = [
  { label: '1m', value: '1MIN' },
  { label: '5m', value: '5MINS' },
  { label: '15m', value: '15MINS' },
  { label: '1h', value: '1HOUR' },
  { label: '4h', value: '4HOURS' },
  { label: '1d', value: '1DAY' },
];

const TradingViewChart = ({ symbol, candles, resolution, onResolutionChange, loading, error, onLoadMore, phase = "Neutral" }: TradingViewChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [earliestLoadedTime, setEarliestLoadedTime] = useState<number | null>(null);
  const lastCandleCountRef = useRef(0);
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Drawing tools state
  const {
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
  } = useChartDrawingTools();
  
  // Refs for managing chart elements
  const indicatorsRef = useRef<Map<string, any>>(new Map());
  const drawnLinesRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const init = async () => {
      if (!chartContainerRef.current || candles.length === 0) return;

      console.log('[TradingViewChart] Chart initialization check:', {
        symbol,
        resolution,
        candlesCount: candles.length,
        firstCandle: candles[0],
        lastCandle: candles[candles.length - 1],
        containerRef: !!chartContainerRef.current,
        containerHeight: chartContainerRef.current?.clientHeight,
        containerWidth: chartContainerRef.current?.clientWidth,
      });

      // Load lightweight-charts from CDN with retry logic
      let lib: any = (window as any).LightweightCharts;
      if (!lib) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-lwc-cdn="true"]') as HTMLScriptElement | null;
          if (existing) {
            // Wait for existing script to load
            const checkLib = () => {
              if ((window as any).LightweightCharts) {
                resolve();
              } else {
                setTimeout(checkLib, 100);
              }
            };
            checkLib();
          } else {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/lightweight-charts@3.8.0/dist/lightweight-charts.standalone.production.js';
            s.async = true;
            s.setAttribute('data-lwc-cdn', 'true');
            s.onload = () => {
              // Double-check lib is available after load
              const checkLib = () => {
                if ((window as any).LightweightCharts) {
                  resolve();
                } else {
                  setTimeout(checkLib, 50);
                }
              };
              checkLib();
            };
            s.onerror = () => reject(new Error('Failed to load lightweight-charts CDN'));
            document.head.appendChild(s);
          }
        });
        lib = (window as any).LightweightCharts;
      }

      if (disposed) return;

      // Create chart instance with responsive sizing
      const containerHeight = chartContainerRef.current.clientHeight || 400;
      const chart = (lib as any).createChart(chartContainerRef.current, {
        layout: {
          background: { color: 'transparent' },
          textColor: '#D4AF37', // aurum color
        },
        grid: {
          vertLines: { color: 'rgba(212, 175, 55, 0.1)' },
          horzLines: { color: 'rgba(212, 175, 55, 0.1)' },
        },
        width: chartContainerRef.current.clientWidth,
        height: containerHeight,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: 'rgba(212, 175, 55, 0.2)',
        },
        rightPriceScale: {
          borderColor: 'rgba(212, 175, 55, 0.2)',
        },
        crosshair: {
          horzLine: {
            color: '#D4AF37',
            labelBackgroundColor: '#D4AF37',
          },
          vertLine: {
            color: '#D4AF37',
            labelBackgroundColor: '#D4AF37',
          },
        },
      });

      // Add candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#16B976', // status-success green
        downColor: '#EF4444', // status-error red
        borderUpColor: '#16B976',
        borderDownColor: '#EF4444',
        wickUpColor: '#16B976',
        wickDownColor: '#EF4444',
      });

      // Add volume histogram series with dedicated scale
      const volumeSeries = chart.addHistogramSeries({
        color: 'rgba(212, 175, 55, 0.3)',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume', // Explicit scale ID
      });

      // Configure volume scale to be at bottom 20% of chart
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      // Transform data to chart format with timestamp validation and null filtering
      const validCandles = candles.filter(
        c => c.timestamp != null && c.open != null && c.high != null && c.low != null && c.close != null
      );

      // Sort ascending by timestamp (required by lightweight-charts)
      const sortedCandles = validCandles.sort((a, b) => a.timestamp - b.timestamp);

      console.log("[Chart Debug] First candle:", sortedCandles[0], "Invalid candles:", candles.length - validCandles.length);

      const chartData = sortedCandles.map((candle) => ({
        time: Math.floor(
          candle.timestamp > 1e12 ? candle.timestamp / 1000 : candle.timestamp
        ),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      const volumeData = sortedCandles
        .filter(c => c.volume != null)
        .map((candle) => ({
          time: Math.floor(
            candle.timestamp > 1e12 ? candle.timestamp / 1000 : candle.timestamp
          ),
          value: candle.volume,
          color: candle.close > candle.open 
            ? 'rgba(16, 185, 129, 0.5)' // green with transparency
            : 'rgba(239, 68, 68, 0.5)', // red with transparency
        }));

      candleSeries.setData(chartData);
      volumeSeries.setData(volumeData);

      // Set up lazy loading on scroll
      if (onLoadMore) {
        chart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
          if (!range || !chartData.length) return;
          
          const firstVisibleTime = chartData[Math.floor(range.from)]?.time;
          if (firstVisibleTime && (!earliestLoadedTime || firstVisibleTime < earliestLoadedTime)) {
            setEarliestLoadedTime(firstVisibleTime);
            // Trigger load more when scrolling near the beginning
            if (range.from < 10) {
              console.log('[TradingViewChart] Loading more historical data');
              onLoadMore();
            }
          }
        });
      }

      // Fit content to view
      chart.timeScale().fitContent();

      // Store refs
      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
      
      // Subscribe to chart clicks for drawing tools
      chart.subscribeClick((param: any) => {
        if (!param.point || !param.time) return;
        
        const price = param.seriesPrices.get(candleSeries);
        if (!price) return;
        
        if (drawingMode === 'horizontal') {
          // Create horizontal price line
          const priceLine = candleSeries.createPriceLine({
            price: price,
            color: '#D4AF37',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'S/R',
          });
          
          const lineId = `h-line-${Date.now()}`;
          drawnLinesRef.current.set(lineId, priceLine);
          addLine({
            id: lineId,
            type: 'horizontal',
            price: price,
          });
          
          // Auto-exit drawing mode after placing line
          toggleDrawingMode('none');
        } else if (drawingMode === 'trendline') {
          if (!trendLineStart) {
            // First click - set start point
            setTrendLineStart({ time: param.time as number, price });
          } else {
            // Second click - complete trend line
            const trendSeries = chart.addLineSeries({
              color: '#D4AF37',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            
            trendSeries.setData([
              { time: trendLineStart.time, value: trendLineStart.price },
              { time: param.time as number, value: price },
            ]);
            
            const lineId = `t-line-${Date.now()}`;
            drawnLinesRef.current.set(lineId, trendSeries);
            addLine({
              id: lineId,
              type: 'trendline',
              points: [
                { time: trendLineStart.time, price: trendLineStart.price },
                { time: param.time as number, price },
              ],
            });
            
            // Reset and exit drawing mode
            setTrendLineStart(null);
            toggleDrawingMode('none');
          }
        }
      });

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      cleanup = () => {
        window.removeEventListener('resize', handleResize);
        // Clear all drawn lines and indicators
        drawnLinesRef.current.clear();
        indicatorsRef.current.forEach(series => {
          try {
            chart.removeSeries(series);
          } catch (e) {
            // Series may already be removed
          }
        });
        indicatorsRef.current.clear();
        chart.remove();
      };
    };

    init();

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [symbol, resolution, onLoadMore]);

  // Update existing chart when candles change (without remounting)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    // Debounce rapid updates
    if (updateDebounceRef.current) {
      clearTimeout(updateDebounceRef.current);
    }

    updateDebounceRef.current = setTimeout(() => {
      const validCandles = candles.filter(
        c => c.timestamp != null && c.open != null && c.high != null && c.low != null && c.close != null
      );

      // Sort ascending by timestamp (required by lightweight-charts)
      const sortedCandles = validCandles.sort((a, b) => a.timestamp - b.timestamp);

      const chartData = sortedCandles.map((candle) => ({
        time: Math.floor(
          candle.timestamp > 1e12 ? candle.timestamp / 1000 : candle.timestamp
        ),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      const volumeData = sortedCandles
        .filter(c => c.volume != null)
        .map((candle) => ({
          time: Math.floor(
            candle.timestamp > 1e12 ? candle.timestamp / 1000 : candle.timestamp
          ),
          value: candle.volume,
          color: candle.close > candle.open 
            ? 'rgba(16, 185, 129, 0.5)'
            : 'rgba(239, 68, 68, 0.5)',
        }));

      // Detect if this is an incremental update (1-2 new candles) or full reload
      const isIncrementalUpdate = Math.abs(chartData.length - lastCandleCountRef.current) <= 2 
        && lastCandleCountRef.current > 0;

      if (isIncrementalUpdate && chartData.length > 0) {
        // Incremental update: only update the last few candles
        const lastCandle = chartData[chartData.length - 1];
        const lastVolume = volumeData[volumeData.length - 1];
        
        try {
          candleSeriesRef.current.update(lastCandle);
          if (lastVolume) {
            volumeSeriesRef.current.update(lastVolume);
          }
        } catch (e) {
          // If update fails, fall back to setData
          console.log('[Chart] Incremental update failed, using setData:', e);
          candleSeriesRef.current.setData(chartData);
          volumeSeriesRef.current.setData(volumeData);
        }
      } else {
        // Full reload: use setData and fit content
        candleSeriesRef.current.setData(chartData);
        volumeSeriesRef.current.setData(volumeData);
        
        // Only fit content on full reload (symbol/resolution change)
        if (lastCandleCountRef.current === 0) {
          chartRef.current.timeScale().fitContent();
        }
      }

      lastCandleCountRef.current = chartData.length;
    }, 150); // 150ms debounce for batching rapid updates

    return () => {
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
      }
    };
  }, [candles]);

  // Manage indicators (moving averages)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    if (candles.length === 0) return;

    // Remove old indicators
    indicatorsRef.current.forEach((series) => {
      try {
        chartRef.current.removeSeries(series);
      } catch (e) {
        // Series may already be removed
      }
    });
    indicatorsRef.current.clear();

    // Add active indicators
    activeIndicators.forEach((indicator) => {
      if (indicator.startsWith('MA')) {
        const period = parseInt(indicator.slice(2));
        const maData = calculateSMA(candles, period);

        if (maData.length > 0) {
          const maSeries = chartRef.current.addLineSeries({
            color: period === 20 ? '#3B82F6' : period === 50 ? '#9333EA' : '#EF4444',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: true,
            priceScaleId: '', // Overlay on main scale
          });

          maSeries.setData(maData);
          indicatorsRef.current.set(indicator, maSeries);
        }
      }
    });
  }, [activeIndicators, candles]);

  // Clear drawings when symbol/resolution changes
  useEffect(() => {
    drawnLinesRef.current.forEach((line, id) => {
      try {
        if (line.removePriceLine) {
          // It's a price line
          candleSeriesRef.current?.removePriceLine(line);
        } else if (line.setData) {
          // It's a series
          chartRef.current?.removeSeries(line);
        }
      } catch (e) {
        // Already removed
      }
    });
    drawnLinesRef.current.clear();
    clearAll();
  }, [symbol, resolution]);

  const handleTimeframeChange = (newResolution: string) => {
    setIsLoading(true);
    onResolutionChange(newResolution);
    setTimeout(() => setIsLoading(false), 500);
  };

  if (error) {
    return (
      <Card className="h-full bg-black/60 border-aurum/20">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 font-semibold mb-2">Failed to load chart data</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading || candles.length === 0) {
    return (
      <Card className="h-full bg-black/60 border-aurum/20">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 text-aurum animate-spin" />
            <p className="text-muted-foreground">
              {loading ? 'Loading chart data...' : 'No data available for this asset'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      {/* Timeframe Selector */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Timeframe:</span>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf.value}
                variant={resolution === tf.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTimeframeChange(tf.value)}
                disabled={isLoading}
                className={
                  resolution === tf.value
                    ? 'bg-aurum text-black hover:bg-aurum-glow h-7 text-xs'
                    : 'border-aurum/20 text-aurum hover:bg-aurum/10 h-7 text-xs'
                }
              >
                {tf.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="text-sm font-semibold text-aurum">
          {symbol}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative flex-1">
        <SpiralOverlay phase={phase} />
        
        {/* Drawing Tools - Overlaid on chart */}
        <div className="absolute top-3 left-3 z-10">
          <ChartDrawingTools
            drawingMode={drawingMode}
            onDrawingModeChange={toggleDrawingMode}
            activeIndicators={activeIndicators}
            onToggleIndicator={toggleIndicator}
            onClearAll={clearAll}
            disabled={isLoading || loading}
          />
        </div>
        
        <div 
          ref={chartContainerRef} 
          className="w-full h-full rounded-lg border border-aurum/20 bg-gradient-to-br from-black/80 to-zinc-950/80"
        />
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <Loader2 className="h-8 w-8 text-aurum animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingViewChart;
