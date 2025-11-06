import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { HyperliquidCandle } from '@/types/hyperliquid';
import { Loader2, TrendingUp } from 'lucide-react';
import { SpiralOverlay } from '@/components/SpiralOverlay';
import { ChartDrawingTools } from './ChartDrawingTools';
import { useChartDrawingTools } from '@/hooks/useChartDrawingTools';
import { calculateSMA } from '@/utils/chartIndicators';
import { calculateVWAP, calculateRSI, calculateMACD } from '@/utils/advancedChartIndicators';
import { useChartPersistence } from '@/hooks/useChartPersistence';
import { LiveModeToggle } from './LiveModeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TradingViewChartProps {
  symbol: string;
  candles: HyperliquidCandle[];
  resolution: string;
  onResolutionChange: (resolution: string) => void;
  loading?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  phase?: string;
  isBackfilling?: boolean;
}

const TIMEFRAMES = [
  { label: '1m', value: '1MIN' },
  { label: '5m', value: '5MINS' },
  { label: '15m', value: '15MINS' },
  { label: '1h', value: '1HOUR' },
  { label: '4h', value: '4HOURS' },
  { label: '1d', value: '1DAY' },
];

const TradingViewChart = ({ 
  symbol, 
  candles, 
  resolution, 
  onResolutionChange, 
  loading, 
  error, 
  onLoadMore, 
  phase = "Neutral",
  isBackfilling = false 
}: TradingViewChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [earliestLoadedTime, setEarliestLoadedTime] = useState<number | null>(null);
  const lastCandleCountRef = useRef(0);
  const onLoadMoreRef = useRef<(() => void) | undefined>(onLoadMore);
  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);
  
  // Chart persistence
  const {
    settings,
    loading: settingsLoading,
    updateIndicators,
    updateDrawings,
    updateViewport,
    toggleLiveMode,
  } = useChartPersistence(symbol, resolution);
  
  // Drawing tools state (sync with persisted settings)
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
  
  // Enable default indicators on mount
  useEffect(() => {
    if (activeIndicators.size === 0) {
      // Enable MA20 and MA50 by default
      toggleIndicator('MA20');
      toggleIndicator('MA50');
    }
  }, []);
  
  // Refs for managing chart elements
  const indicatorsRef = useRef<Map<string, any>>(new Map());
  const drawnLinesRef = useRef<Map<string, any>>(new Map());

  // Memoize indicator calculations for performance
  const indicatorData = useMemo(() => {
    if (!candles || candles.length === 0) return null;

    const data: Record<string, any> = {};

    activeIndicators.forEach(indicator => {
      try {
        if (indicator.startsWith('MA')) {
          const period = parseInt(indicator.slice(2));
          data[indicator] = calculateSMA(candles, period);
        } else if (indicator === 'VWAP') {
          data.vwap = calculateVWAP(candles);
        } else if (indicator === 'RSI') {
          data.rsi = calculateRSI(candles, 14);
        } else if (indicator === 'MACD') {
          data.macd = calculateMACD(candles);
        }
      } catch (error) {
        console.error(`[Chart] Error calculating ${indicator}:`, error);
      }
    });

    return data;
  }, [candles, activeIndicators]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const init = async () => {
      // Prevent double-initialization
      if (chartRef.current) {
        console.log('[TradingViewChart] Chart already exists, skipping init');
        return;
      }
      
      if (!chartContainerRef.current) return;
      
      // Wait for container to have dimensions
      if (chartContainerRef.current.clientHeight === 0) {
        console.log('[TradingViewChart] Container not ready, waiting...');
        return;
      }

      if (candles.length === 0) {
        console.log('[TradingViewChart] No candles yet, waiting...');
        return;
      }

      console.log('[TradingViewChart] Chart initialization:', {
        symbol,
        resolution,
        candlesCount: candles.length,
        containerHeight: chartContainerRef.current?.clientHeight,
        containerWidth: chartContainerRef.current?.clientWidth,
      });

      if (disposed) return;

      // Create chart instance with stable sizing
      const containerHeight = Math.max(chartContainerRef.current.clientHeight, 400);
      const containerWidth = Math.max(chartContainerRef.current.clientWidth, 600);
      
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: 'transparent' },
          textColor: '#D4AF37', // aurum color
        },
        grid: {
          vertLines: { color: 'rgba(212, 175, 55, 0.1)' },
          horzLines: { color: 'rgba(212, 175, 55, 0.1)' },
        },
        width: containerWidth,
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
      // Hyperliquid candles use: t (timestamp), o (open), h (high), l (low), c (close), v (volume)
      const validCandles = candles.filter(
        c => c.t != null && c.o != null && c.h != null && c.l != null && c.c != null
      );

      // Sort ascending by timestamp (required by lightweight-charts)
      const sortedCandles = validCandles.sort((a, b) => a.t - b.t);

      console.log("[Chart Debug] First candle:", sortedCandles[0], "Invalid candles:", candles.length - validCandles.length);

      const chartData = sortedCandles.map((candle) => ({
        time: Math.floor(
          candle.t > 1e12 ? candle.t / 1000 : candle.t
        ) as any,
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
      }));

      const volumeData = sortedCandles
        .filter(c => c.v != null)
        .map((candle) => ({
          time: Math.floor(
            candle.t > 1e12 ? candle.t / 1000 : candle.t
          ) as any,
          value: parseFloat(candle.v),
          color: parseFloat(candle.c) > parseFloat(candle.o) 
            ? 'rgba(16, 185, 129, 0.5)' // green with transparency
            : 'rgba(239, 68, 68, 0.5)', // red with transparency
        }));

      candleSeries.setData(chartData);
      volumeSeries.setData(volumeData);
      
      console.log('[TradingViewChart] Chart initialized successfully:', {
        symbol,
        resolution,
        candlesCount: chartData.length,
        firstTime: chartData[0]?.time,
        lastTime: chartData[chartData.length - 1]?.time
      });

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
            lineVisible: true,
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
              { time: trendLineStart.time as any, value: trendLineStart.price },
              { time: param.time as any, value: price },
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

      // Handle resize with debouncing
      let resizeTimeout: NodeJS.Timeout;
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (chartContainerRef.current && chartRef.current) {
            const newWidth = chartContainerRef.current.clientWidth;
            const newHeight = chartContainerRef.current.clientHeight;
            if (newWidth > 0 && newHeight > 0) {
              chartRef.current.applyOptions({
                width: newWidth,
                height: newHeight,
              });
            }
          }
        }, 100);
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
  }, [symbol, resolution, onLoadMore, candles.length]);

  // Update existing chart when candles change (without remounting)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    // Process updates immediately for real-time feel
    // Hyperliquid candles use: t (timestamp), o (open), h (high), l (low), c (close), v (volume)
    const validCandles = candles.filter(
      c => c.t != null && c.o != null && c.h != null && c.l != null && c.c != null
    );

    // Sort ascending by timestamp (required by lightweight-charts)
    const sortedCandles = validCandles.sort((a, b) => a.t - b.t);

    const chartData = sortedCandles.map((candle) => ({
      time: Math.floor(
        candle.t > 1e12 ? candle.t / 1000 : candle.t
      ) as any,
      open: parseFloat(candle.o),
      high: parseFloat(candle.h),
      low: parseFloat(candle.l),
      close: parseFloat(candle.c),
    }));

    const volumeData = sortedCandles
      .filter(c => c.v != null)
      .map((candle) => ({
        time: Math.floor(
          candle.t > 1e12 ? candle.t / 1000 : candle.t
        ) as any,
        value: parseFloat(candle.v),
        color: parseFloat(candle.c) > parseFloat(candle.o) 
          ? 'rgba(16, 185, 129, 0.5)'
          : 'rgba(239, 68, 68, 0.5)',
      }));

    // Detect if this is an incremental update (1-2 new candles) or full reload
    const isIncrementalUpdate = Math.abs(chartData.length - lastCandleCountRef.current) <= 2 
      && lastCandleCountRef.current > 0;

    if (isIncrementalUpdate && chartData.length > 0) {
      // Incremental update: only update the last candle for smooth real-time updates
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
  }, [candles]);

  // Manage indicators using memoized data for better performance
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !indicatorData) return;
    
    // Additional safety check: verify chart hasn't been disposed
    try {
      chartRef.current.timeScale();
    } catch (e) {
      console.log('[Chart] Chart not ready for indicators');
      return;
    }

    // Remove old indicators safely
    indicatorsRef.current.forEach((series) => {
      try {
        if (chartRef.current) {
          chartRef.current.removeSeries(series);
        }
      } catch (e) {
        // Series may already be removed
      }
    });
    indicatorsRef.current.clear();

    // Add active indicators using pre-calculated data from useMemo
    activeIndicators.forEach((indicator) => {
      try {
        if (indicator.startsWith('MA') && indicatorData[indicator]) {
          const period = parseInt(indicator.slice(2));
          const maData = indicatorData[indicator];

          if (maData.length > 0 && chartRef.current) {
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
        } else if (indicator === 'VWAP' && indicatorData.vwap) {
          const vwapData = indicatorData.vwap;
          
          if (vwapData.length > 0 && chartRef.current) {
            const vwapSeries = chartRef.current.addLineSeries({
              color: '#F59E0B',
              lineWidth: 2,
              lineStyle: 2, // Dashed
              priceLineVisible: false,
              lastValueVisible: true,
              crosshairMarkerVisible: true,
            });
            
            vwapSeries.setData(vwapData);
            indicatorsRef.current.set(indicator, vwapSeries);
          }
        } else if (indicator === 'RSI' && indicatorData.rsi) {
          const rsiData = indicatorData.rsi;
          
          if (rsiData.length > 0 && chartRef.current) {
            const rsiSeries = chartRef.current.addLineSeries({
              color: '#8B5CF6',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              priceScaleId: 'rsi', // Separate scale
            });
            
            // Configure RSI scale (0-100)
            chartRef.current.priceScale('rsi').applyOptions({
              scaleMargins: {
                top: 0.7,
                bottom: 0,
              },
            });
            
            rsiSeries.setData(rsiData);
            indicatorsRef.current.set(indicator, rsiSeries);
          }
        } else if (indicator === 'MACD' && indicatorData.macd) {
          const macdData = indicatorData.macd;
          
          if (macdData.histogram.length > 0 && chartRef.current) {
            // MACD histogram
            const macdHistogram = chartRef.current.addHistogramSeries({
              color: '#10B981',
              priceFormat: {
                type: 'volume',
              },
              priceScaleId: 'macd',
            });
            
            // Configure MACD scale
            chartRef.current.priceScale('macd').applyOptions({
              scaleMargins: {
                top: 0.7,
                bottom: 0,
              },
            });
            
            macdHistogram.setData(macdData.histogram);
            indicatorsRef.current.set('MACD', macdHistogram);
          }
        }
      } catch (e) {
        console.warn('[Chart] Failed to add indicator:', indicator, e);
      }
    });
    
    // (Persistence moved to a separate effect to avoid render loops)
  }, [indicatorData, activeIndicators]);

  // Persist active indicators separately to avoid unnecessary reruns
  useEffect(() => {
    updateIndicators(Array.from(activeIndicators));
  }, [activeIndicators, updateIndicators]);
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
    <div className="flex flex-col w-full h-full gap-2 p-3">
      {/* Indicator Dropdown and Timeframe Selector */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Indicators Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-aurum/20 text-aurum hover:bg-aurum/10 h-7 text-xs gap-1.5"
                disabled={isLoading || loading}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Indicators {activeIndicators.size > 0 && `(${activeIndicators.size})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="start" 
              className="w-56 bg-[#1a1712] border-aurum/20 z-50"
            >
              <DropdownMenuLabel className="text-aurum">Moving Averages</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={activeIndicators.has('MA20')}
                onCheckedChange={() => toggleIndicator('MA20')}
                className="text-muted-foreground hover:text-aurum hover:bg-aurum/10"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-blue-500" />
                  MA 20
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activeIndicators.has('MA50')}
                onCheckedChange={() => toggleIndicator('MA50')}
                className="text-muted-foreground hover:text-aurum hover:bg-aurum/10"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-purple-500" />
                  MA 50
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activeIndicators.has('MA100')}
                onCheckedChange={() => toggleIndicator('MA100')}
                className="text-muted-foreground hover:text-aurum hover:bg-aurum/10"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-red-500" />
                  MA 100
                </span>
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator className="bg-aurum/20" />
              <DropdownMenuLabel className="text-aurum">Volume</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={activeIndicators.has('VWAP')}
                onCheckedChange={() => toggleIndicator('VWAP')}
                className="text-muted-foreground hover:text-aurum hover:bg-aurum/10"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-amber-500" />
                  VWAP
                </span>
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator className="bg-aurum/20" />
              <DropdownMenuLabel className="text-aurum">Momentum</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={activeIndicators.has('RSI')}
                onCheckedChange={() => toggleIndicator('RSI')}
                className="text-muted-foreground hover:text-aurum hover:bg-aurum/10"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-violet-500" />
                  RSI (14)
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={activeIndicators.has('MACD')}
                onCheckedChange={() => toggleIndicator('MACD')}
                className="text-muted-foreground hover:text-aurum hover:bg-aurum/10"
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-emerald-500" />
                  MACD
                </span>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Active Indicators Legend */}
          {activeIndicators.size > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 bg-[#2a251a]/50 rounded border border-aurum/10">
              {Array.from(activeIndicators).map(ind => (
                <div key={ind} className="flex items-center gap-1 text-xs">
                  <span className={`w-2 h-0.5 ${
                    ind === 'MA20' ? 'bg-blue-500' :
                    ind === 'MA50' ? 'bg-purple-500' :
                    ind === 'MA100' ? 'bg-red-500' :
                    ind === 'VWAP' ? 'bg-amber-500' :
                    ind === 'RSI' ? 'bg-violet-500' :
                    ind === 'MACD' ? 'bg-emerald-500' : 'bg-gray-500'
                  }`} />
                  <span className="text-muted-foreground">{ind}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeframe Buttons */}
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
        </div>
        
        {/* Symbol and Live Indicator */}
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-aurum">
            {symbol} • {candles.length} candles
          </div>
          {isBackfilling && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading history...
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-status-success">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
            </span>
            Live
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative flex-1 min-h-0">
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
