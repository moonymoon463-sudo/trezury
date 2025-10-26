import type { DydxCandle } from '@/types/dydx';

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(
  candles: DydxCandle[], 
  period: number
): { time: number; value: number }[] {
  if (!candles || candles.length === 0) return [];
  
  const result: { time: number; value: number }[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const timestamp = Math.floor(
      candles[i].timestamp > 1e12 
        ? candles[i].timestamp / 1000 
        : candles[i].timestamp
    );
    
    if (i < period - 1) {
      // Not enough data points yet - skip
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    
    result.push({
      time: timestamp,
      value: sum / period
    });
  }
  
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(
  candles: DydxCandle[], 
  period: number
): { time: number; value: number }[] {
  if (!candles || candles.length === 0 || period <= 0) return [];
  
  const result: { time: number; value: number }[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for the first period
  let ema = 0;
  for (let i = 0; i < Math.min(period, candles.length); i++) {
    ema += candles[i].close;
  }
  ema = ema / Math.min(period, candles.length);
  
  for (let i = period - 1; i < candles.length; i++) {
    const timestamp = Math.floor(
      candles[i].timestamp > 1e12 
        ? candles[i].timestamp / 1000 
        : candles[i].timestamp
    );
    
    ema = (candles[i].close - ema) * multiplier + ema;
    
    result.push({
      time: timestamp,
      value: ema
    });
  }
  
  return result;
}
