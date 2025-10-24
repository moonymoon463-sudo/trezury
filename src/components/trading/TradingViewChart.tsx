import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DydxCandle } from '@/types/dydx';
import { Loader2 } from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  candles: DydxCandle[];
  resolution: string;
  onResolutionChange: (resolution: string) => void;
}

const TIMEFRAMES = [
  { label: '1m', value: '1MIN' },
  { label: '5m', value: '5MINS' },
  { label: '15m', value: '15MINS' },
  { label: '1h', value: '1HOUR' },
  { label: '4h', value: '4HOURS' },
  { label: '1d', value: '1DAY' },
];

const TradingViewChart = ({ symbol, candles, resolution, onResolutionChange }: TradingViewChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Create chart instance
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: 'hsl(43, 65%, 55%)', // aurum color
      },
      grid: {
        vertLines: { color: 'rgba(212, 175, 55, 0.1)' },
        horzLines: { color: 'rgba(212, 175, 55, 0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
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
          color: 'hsl(43, 65%, 55%)',
          labelBackgroundColor: 'hsl(43, 65%, 55%)',
        },
        vertLine: {
          color: 'hsl(43, 65%, 55%)',
          labelBackgroundColor: 'hsl(43, 65%, 55%)',
        },
      },
    });

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: 'hsl(142, 76%, 36%)', // status-success green
      downColor: 'hsl(0, 84%, 60%)', // status-error red
      borderUpColor: 'hsl(142, 76%, 36%)',
      borderDownColor: 'hsl(0, 84%, 60%)',
      wickUpColor: 'hsl(142, 76%, 36%)',
      wickDownColor: 'hsl(0, 84%, 60%)',
    });

    // Add volume histogram series
    const volumeSeries = chart.addHistogramSeries({
      color: 'rgba(212, 175, 55, 0.3)',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    // Transform data to chart format
    const chartData = candles.map((candle) => ({
      time: candle.timestamp as any,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    const volumeData = candles.map((candle) => ({
      time: candle.timestamp as any,
      value: candle.volume,
      color: candle.close > candle.open 
        ? 'rgba(16, 185, 129, 0.5)' // green with transparency
        : 'rgba(239, 68, 68, 0.5)', // red with transparency
    }));

    candleSeries.setData(chartData);
    volumeSeries.setData(volumeData);

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

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles]);

  const handleTimeframeChange = (newResolution: string) => {
    setIsLoading(true);
    onResolutionChange(newResolution);
    setTimeout(() => setIsLoading(false), 500);
  };

  if (candles.length === 0) {
    return (
      <Card className="h-full bg-black/60 border-aurum/20">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 text-aurum animate-spin" />
            <p className="text-muted-foreground">Loading chart data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeframe Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Timeframe:</span>
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
                    ? 'bg-aurum text-black hover:bg-aurum-glow'
                    : 'border-aurum/20 text-aurum hover:bg-aurum/10'
                }
              >
                {tf.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="text-sm font-medium text-aurum">
          {symbol}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        <div 
          ref={chartContainerRef} 
          className="w-full rounded-lg border border-aurum/20 bg-gradient-to-br from-black/80 to-zinc-950/80"
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
