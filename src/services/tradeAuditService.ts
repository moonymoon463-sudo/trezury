import { supabase } from '@/integrations/supabase/client';

interface TradeAuditEntry {
  action: string;
  market: string;
  orderDetails: Record<string, any>;
  result?: string;
  errorMessage?: string;
}

class TradeAuditService {
  /**
   * Log a trade action to the audit log
   */
  async logTradeAction(entry: TradeAuditEntry): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[TradeAuditService] No user found, skipping audit log');
        return;
      }

      // Get request metadata
      const userAgent = navigator.userAgent;
      const timestamp = new Date().toISOString();

      const { error } = await supabase
        .from('trade_audit_log')
        .insert({
          user_id: user.id,
          action: entry.action,
          market: entry.market,
          order_details: entry.orderDetails,
          result: entry.result,
          error_message: entry.errorMessage,
          user_agent: userAgent,
          created_at: timestamp,
        });

      if (error) {
        console.error('[TradeAuditService] Failed to log audit entry:', error);
      }
    } catch (err) {
      console.error('[TradeAuditService] Error logging audit:', err);
    }
  }

  /**
   * Log an order placement
   */
  async logOrderPlacement(
    market: string,
    orderType: string,
    side: 'BUY' | 'SELL',
    size: number,
    price: number | undefined,
    leverage: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.logTradeAction({
      action: 'ORDER_PLACED',
      market,
      orderDetails: {
        order_type: orderType,
        side,
        size,
        price,
        leverage,
        timestamp: new Date().toISOString(),
      },
      result: success ? 'success' : 'failed',
      errorMessage: error,
    });
  }

  /**
   * Log an order cancellation
   */
  async logOrderCancellation(
    market: string,
    orderId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.logTradeAction({
      action: 'ORDER_CANCELLED',
      market,
      orderDetails: {
        order_id: orderId,
        timestamp: new Date().toISOString(),
      },
      result: success ? 'success' : 'failed',
      errorMessage: error,
    });
  }

  /**
   * Log a position close
   */
  async logPositionClose(
    market: string,
    size: number,
    closeType: 'MARKET' | 'LIMIT',
    price: number | undefined,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.logTradeAction({
      action: 'POSITION_CLOSED',
      market,
      orderDetails: {
        size,
        close_type: closeType,
        price,
        timestamp: new Date().toISOString(),
      },
      result: success ? 'success' : 'failed',
      errorMessage: error,
    });
  }

  /**
   * Get user's recent audit logs
   */
  async getUserAuditLogs(limit: number = 50): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('trade_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[TradeAuditService] Error fetching audit logs:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('[TradeAuditService] Error fetching audit logs:', err);
      return [];
    }
  }
}

export const tradeAuditService = new TradeAuditService();
