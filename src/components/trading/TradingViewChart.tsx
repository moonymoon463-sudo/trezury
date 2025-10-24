import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeriesPartialOptions } from 'lightweight-charts';
import { useDydxCandles } from '@/hooks/useDydxCandles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TradingViewChartProps {
  symbol: string | null;
}

const TIMEFRAMES = [
  { label: '1m', value: '1MIN' },
  { label: '5m', value: '5MINS' },
  { label: '15m', value: '15MINS' },
  { label: '1h', value: '1HOUR' },
  { label: '4h', value: '4HOURS' },
  { label: '1D', value: '1DAY' },
];

export const TradingViewChart = ({ symbol }: TradingViewChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const [resolution, setResolution] = useState('1HOUR');
  const { candles, loading, error } = useDydxCandles(symbol, resolution, 200);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 215, 0, 0.1)' },
        horzLines: { color: 'rgba(255, 215, 0, 0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 215, 0, 0.2)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 215, 0, 0.2)',
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255, 215, 0, 0.5)',
          width: 1,
          style: 1,
        },
        horzLine: {
          color: 'rgba(255, 215, 0, 0.5)',
          width: 1,
          style: 1,
        },
      },
    });

    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    } as CandlestickSeriesPartialOptions);

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data when candles change
  useEffect(() => {
    if (!seriesRef.current || !candles.length) {
      console.log('[TradingViewChart] No data to display:', { hasRef: !!seriesRef.current, candlesLength: candles.length });
      return;
    }

    console.log('[TradingViewChart] Updating chart with', candles.length, 'candles');
    console.log('[TradingViewChart] First candle:', candles[0]);
    console.log('[TradingViewChart] Last candle:', candles[candles.length - 1]);

    const formattedData = candles.map(candle => ({
      time: candle.timestamp as any,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    // Validate timestamp format (should be in seconds, 10 digits)
    const firstTimestamp = formattedData[0]?.time;
    if (firstTimestamp && firstTimestamp.toString().length !== 10) {
      console.error('[TradingViewChart] Invalid timestamp format! Expected seconds (10 digits), got:', firstTimestamp);
    }

    seriesRef.current.setData(formattedData);
    chartRef.current?.timeScale().fitContent();
    console.log('[TradingViewChart] Chart updated successfully');
  }, [candles]);

  if (!symbol) {
    return (
      <Card className="h-full bg-black/60 border-aurum/20 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <TrendingUp className="h-16 w-16 mx-auto mb-4 text-aurum/40" />
          <p className="text-lg">Select an asset to view chart</p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full bg-black/60 border-aurum/20 p-6">
        <Skeleton className="h-full w-full rounded-lg" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full bg-black/60 border-aurum/20 flex items-center justify-center">
        <div className="text-center text-destructive">
          <TrendingDown className="h-16 w-16 mx-auto mb-4" />
          <p className="text-lg font-semibold">Failed to load chart data</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-black/60 border-aurum/20 flex flex-col">
      {/* Timeframe selector */}
      <div className="flex items-center gap-2 p-4 border-b border-aurum/20">
        {TIMEFRAMES.map((tf) => (
          <Button
            key={tf.value}
            variant={resolution === tf.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setResolution(tf.value)}
            className={resolution === tf.value ? 'bg-aurum text-black hover:bg-aurum-glow' : 'text-muted-foreground hover:text-aurum'}
          >
            {tf.label}
          </Button>
        ))}
      </div>

      {/* Chart container */}
      <div ref={chartContainerRef} className="flex-1 w-full" />
    </Card>
  );
};
