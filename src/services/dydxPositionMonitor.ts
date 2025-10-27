import { supabase } from '@/integrations/supabase/client';

class DydxPositionMonitor {
  private intervalId: number | null = null;
  private isMonitoring = false;

  /**
   * Start monitoring positions for a given dYdX address
   * Syncs every 30 seconds from dYdX Indexer
   */
  async startMonitoring(dydxAddress: string, intervalMs: number = 30000) {
    if (this.isMonitoring) {
      console.log('[DydxPositionMonitor] Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log('[DydxPositionMonitor] Starting position monitoring for', dydxAddress);

    // Initial sync
    await this.syncPositions(dydxAddress);

    // Set up interval for periodic sync
    this.intervalId = window.setInterval(async () => {
      await this.syncPositions(dydxAddress);
    }, intervalMs);
  }

  /**
   * Stop monitoring positions
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    console.log('[DydxPositionMonitor] Stopped monitoring');
  }

  /**
   * Sync positions from dYdX Indexer
   */
  private async syncPositions(dydxAddress: string) {
    try {
      const { data, error } = await supabase.functions.invoke('sync-dydx-positions', {
        body: { dydxAddress }
      });

      if (error) {
        console.error('[DydxPositionMonitor] Sync error:', error);
        return;
      }

      console.log('[DydxPositionMonitor] Synced', data.synced, 'positions');

      // Check for liquidation risks
      if (data.positions && data.positions.length > 0) {
        await this.checkLiquidationRisks(data.positions);
      }

    } catch (error) {
      console.error('[DydxPositionMonitor] Failed to sync positions:', error);
    }
  }

  /**
   * Check positions for liquidation risk and send alerts
   */
  private async checkLiquidationRisks(positions: any[]) {
    for (const position of positions) {
      if (!position.liquidation_price || !position.entry_price) continue;

      const distanceToLiquidation = position.side === 'LONG'
        ? (position.entry_price - position.liquidation_price) / position.entry_price
        : (position.liquidation_price - position.entry_price) / position.entry_price;

      // Alert if within 15% of liquidation
      if (distanceToLiquidation < 0.15) {
        console.warn('[DydxPositionMonitor] ⚠️ LIQUIDATION RISK:', {
          market: position.market,
          side: position.side,
          size: position.size,
          entryPrice: position.entry_price,
          liquidationPrice: position.liquidation_price,
          distancePercent: (distanceToLiquidation * 100).toFixed(2) + '%'
        });

        // TODO: Create notification when notifications table is available
        // For now, just log the warning
      }
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): { isMonitoring: boolean } {
    return { isMonitoring: this.isMonitoring };
  }
}

export const dydxPositionMonitor = new DydxPositionMonitor();
