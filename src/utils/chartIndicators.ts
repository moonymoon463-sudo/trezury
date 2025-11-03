import type { HyperliquidCandle } from '@/types/hyperliquid';

/**
 * Calculate Simple Moving Average (SMA)
 * Hyperliquid candles use: t (timestamp), o (open), h (high), l (low), c (close), v (volume)
 */
export function calculateSMA(
  candles: HyperliquidCandle[], 
  period: number
): { time: number; value: number }[] {
  if (!candles || candles.length === 0) return [];
  
  const result: { time: number; value: number }[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const timestamp = Math.floor(
      candles[i].t > 1e12 
        ? candles[i].t / 1000 
        : candles[i].t
    );
    
    if (i < period - 1) {
      // Not enough data points yet - skip
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += parseFloat(candles[i - j].c);
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
 * Hyperliquid candles use: t (timestamp), o (open), h (high), l (low), c (close), v (volume)
 */
export function calculateEMA(
  candles: HyperliquidCandle[], 
  period: number
): { time: number; value: number }[] {
  if (!candles || candles.length === 0 || period <= 0) return [];
  
  const result: { time: number; value: number }[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for the first period
  let ema = 0;
  for (let i = 0; i < Math.min(period, candles.length); i++) {
    ema += parseFloat(candles[i].c);
  }
  ema = ema / Math.min(period, candles.length);
  
  for (let i = period - 1; i < candles.length; i++) {
    const timestamp = Math.floor(
      candles[i].t > 1e12 
        ? candles[i].t / 1000 
        : candles[i].t
    );
    
    ema = (parseFloat(candles[i].c) - ema) * multiplier + ema;
    
    result.push({
      time: timestamp,
      value: ema
    });
  }
  
  return result;
}
