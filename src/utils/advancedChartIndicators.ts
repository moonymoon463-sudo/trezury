import type { DydxCandle } from '@/types/dydx';

export interface IndicatorPoint {
  time: number;
  value: number;
}

/**
 * Calculate Volume-Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: DydxCandle[]): IndicatorPoint[] {
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;

  return candles.map(candle => {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    return {
      time: candle.timestamp,
      value: cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice,
    };
  });
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(candles: DydxCandle[], period: number = 14): IndicatorPoint[] {
  if (candles.length < period + 1) {
    return [];
  }

  const results: IndicatorPoint[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate initial gains and losses
  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate first RSI using simple average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  const rs = avgGain / (avgLoss || 1);
  const rsi = 100 - (100 / (1 + rs));
  
  results.push({
    time: candles[period].timestamp,
    value: rsi,
  });

  // Calculate subsequent RSI values using smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    const rs = avgGain / (avgLoss || 1);
    const rsi = 100 - (100 / (1 + rs));
    
    results.push({
      time: candles[i + 1].timestamp,
      value: rsi,
    });
  }

  return results;
}

/**
 * Calculate Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(
  candles: DydxCandle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: IndicatorPoint[]; signal: IndicatorPoint[]; histogram: IndicatorPoint[] } {
  if (candles.length < slowPeriod) {
    return { macd: [], signal: [], histogram: [] };
  }

  // Calculate EMAs
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);

  // Calculate MACD line
  const macdLine: IndicatorPoint[] = [];
  const startIndex = slowPeriod - 1;

  for (let i = startIndex; i < candles.length; i++) {
    macdLine.push({
      time: candles[i].timestamp,
      value: fastEMA[i - (fastPeriod - 1)].value - slowEMA[i - startIndex].value,
    });
  }

  // Calculate Signal line (EMA of MACD)
  const signalLine: IndicatorPoint[] = [];
  if (macdLine.length >= signalPeriod) {
    let ema = macdLine.slice(0, signalPeriod).reduce((sum, p) => sum + p.value, 0) / signalPeriod;
    signalLine.push({ time: macdLine[signalPeriod - 1].time, value: ema });

    const multiplier = 2 / (signalPeriod + 1);
    for (let i = signalPeriod; i < macdLine.length; i++) {
      ema = (macdLine[i].value - ema) * multiplier + ema;
      signalLine.push({ time: macdLine[i].time, value: ema });
    }
  }

  // Calculate Histogram
  const histogram: IndicatorPoint[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    const macdIndex = i + signalPeriod - 1;
    histogram.push({
      time: signalLine[i].time,
      value: macdLine[macdIndex].value - signalLine[i].value,
    });
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
function calculateEMA(candles: DydxCandle[], period: number): IndicatorPoint[] {
  if (candles.length < period) {
    return [];
  }

  const results: IndicatorPoint[] = [];
  const multiplier = 2 / (period + 1);

  // Calculate initial SMA
  let ema = candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;
  results.push({ time: candles[period - 1].timestamp, value: ema });

  // Calculate EMA for remaining candles
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
    results.push({ time: candles[i].timestamp, value: ema });
  }

  return results;
}

/**
 * Calculate Fibonacci retracement levels
 */
export function calculateFibonacciLevels(high: number, low: number): Record<string, number> {
  const diff = high - low;
  
  return {
    '0.0': high,
    '0.236': high - diff * 0.236,
    '0.382': high - diff * 0.382,
    '0.5': high - diff * 0.5,
    '0.618': high - diff * 0.618,
    '0.786': high - diff * 0.786,
    '1.0': low,
  };
}
