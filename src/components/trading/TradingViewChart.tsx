import { useEffect, useRef, useState } from 'react';
// Note: We'll lazy-load lightweight-charts to avoid bundler interop issues
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DydxCandle } from '@/types/dydx';
import { Loader2 } from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  candles: DydxCandle[];
  resolution: string;
  onResolutionChange: (resolution: string) => void;
  loading?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
}

const TIMEFRAMES = [
  { label: '1m', value: '1MIN' },
  { label: '5m', value: '5MINS' },
  { label: '15m', value: '15MINS' },
  { label: '1h', value: '1HOUR' },
  { label: '4h', value: '4HOURS' },
  { label: '1d', value: '1DAY' },
];

const TradingViewChart = ({ symbol, candles, resolution, onResolutionChange, loading, error, onLoadMore }: TradingViewChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [earliestLoadedTime, setEarliestLoadedTime] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const init = async () => {
      if (!chartContainerRef.current || candles.length === 0) return;

      console.log("[TradingViewChart] Initializing chart", {
        candles: candles.slice(0, 3),
        containerHeight: chartContainerRef.current?.clientHeight,
        lightweightChartsReady: !!(window as any).LightweightCharts,
        firstTimestamp: candles[0]?.timestamp,
        isMilliseconds: candles[0]?.timestamp > 1e12
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

      console.log("[Chart Debug] First candle:", candles[0], "Invalid candles:", candles.length - validCandles.length);

      const chartData = validCandles.map((candle) => ({
        time: Math.floor(
          candle.timestamp > 1e12 ? candle.timestamp / 1000 : candle.timestamp
        ),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      const volumeData = validCandles
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
        chart.remove();
      };
    };

    init();

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [candles]);

  // Update existing chart when candles change (without remounting)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    const validCandles = candles.filter(
      c => c.timestamp != null && c.open != null && c.high != null && c.low != null && c.close != null
    );

    const chartData = validCandles.map((candle) => ({
      time: Math.floor(
        candle.timestamp > 1e12 ? candle.timestamp / 1000 : candle.timestamp
      ),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    const volumeData = validCandles
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

    candleSeriesRef.current.setData(chartData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current.timeScale().fitContent();
  }, [candles]);

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
    <div className="flex flex-col h-full gap-3">
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
      <div className="relative flex-1 min-h-[500px]">
        <div 
          ref={chartContainerRef} 
          className="w-full h-full min-h-[500px] rounded-lg border border-aurum/20 bg-gradient-to-br from-black/80 to-zinc-950/80"
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
