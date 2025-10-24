import { supabase } from '@/integrations/supabase/client';

/**
 * Service for monitoring dYdX order fills and position updates via WebSocket
 * 
 * IMPORTANT: This uses the dYdX Indexer WebSocket API to listen for real-time updates.
 * When orders fill, we update the database to reflect the new position/order status.
 */
class DydxOrderMonitor {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isConnected = false;
  private subscriptions = new Map<string, boolean>();

  /**
   * Start monitoring for a specific dYdX address
   */
  async start(dydxAddress: string, userId: string): Promise<void> {
    console.log('[DydxOrderMonitor] Starting monitor for:', dydxAddress);

    // Connect to dYdX Indexer WebSocket
    // Mainnet: wss://indexer.dydx.trade/v4/ws
    // Testnet: wss://indexer.v4testnet.dydx.exchange/v4/ws
    const wsUrl = 'wss://indexer.dydx.trade/v4/ws';

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[DydxOrderMonitor] WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Subscribe to order updates
      this.subscribeToOrders(dydxAddress, userId);
      
      // Subscribe to fill updates
      this.subscribeToFills(dydxAddress, userId);
      
      // Subscribe to subaccount updates (for position changes)
      this.subscribeToSubaccount(dydxAddress, userId);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data, userId);
    };

    this.ws.onerror = (error) => {
      console.error('[DydxOrderMonitor] WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('[DydxOrderMonitor] WebSocket closed');
      this.isConnected = false;
      this.attemptReconnect(dydxAddress, userId);
    };
  }

  /**
   * Subscribe to order updates for this address
   */
  private subscribeToOrders(address: string, userId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const subscriptionId = `orders_${address}`;
    if (this.subscriptions.has(subscriptionId)) return;

    const message = {
      type: 'subscribe',
      channel: 'v4_orders',
      id: address,
      subaccountNumber: 0
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptions.set(subscriptionId, true);
    console.log('[DydxOrderMonitor] Subscribed to orders');
  }

  /**
   * Subscribe to fill events (when orders execute)
   */
  private subscribeToFills(address: string, userId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const subscriptionId = `fills_${address}`;
    if (this.subscriptions.has(subscriptionId)) return;

    const message = {
      type: 'subscribe',
      channel: 'v4_trades',
      id: address,
      subaccountNumber: 0
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptions.set(subscriptionId, true);
    console.log('[DydxOrderMonitor] Subscribed to fills');
  }

  /**
   * Subscribe to subaccount updates (for equity/margin changes)
   */
  private subscribeToSubaccount(address: string, userId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const subscriptionId = `subaccount_${address}`;
    if (this.subscriptions.has(subscriptionId)) return;

    const message = {
      type: 'subscribe',
      channel: 'v4_subaccounts',
      id: address,
      subaccountNumber: 0
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptions.set(subscriptionId, true);
    console.log('[DydxOrderMonitor] Subscribed to subaccount updates');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(data: string, userId: string): Promise<void> {
    try {
      const message = JSON.parse(data);

      if (message.type === 'subscribed') {
        console.log('[DydxOrderMonitor] Subscription confirmed:', message.channel);
        return;
      }

      if (message.type === 'channel_data') {
        const { channel, contents } = message;

        if (channel === 'v4_orders') {
          await this.handleOrderUpdate(contents, userId);
        } else if (channel === 'v4_trades') {
          await this.handleFillUpdate(contents, userId);
        } else if (channel === 'v4_subaccounts') {
          await this.handleSubaccountUpdate(contents, userId);
        }
      }
    } catch (error) {
      console.error('[DydxOrderMonitor] Error handling message:', error);
    }
  }

  /**
   * Handle order status updates
   */
  private async handleOrderUpdate(data: any, userId: string): Promise<void> {
    console.log('[DydxOrderMonitor] Order update:', data);

    // Update database with new order status
    // Example data: { id, status, size, filledSize, remainingSize, ... }
    const orders = Array.isArray(data) ? data : [data];

    for (const order of orders) {
      await supabase
        .from('dydx_orders')
        .update({
          status: order.status,
          filled_size: parseFloat(order.totalFilled || order.filledSize || '0'),
          average_fill_price: parseFloat(order.avgExecutionPrice || '0'),
          updated_at: new Date().toISOString()
        })
        .eq('order_id', order.id)
        .eq('user_id', userId);

      console.log('[DydxOrderMonitor] Updated order:', order.id, 'status:', order.status);
    }
  }

  /**
   * Handle fill events (order executions)
   */
  private async handleFillUpdate(data: any, userId: string): Promise<void> {
    console.log('[DydxOrderMonitor] Fill update:', data);

    const fills = Array.isArray(data) ? data : [data];

    for (const fill of fills) {
      // Update order as filled
      await supabase
        .from('dydx_orders')
        .update({
          status: 'FILLED',
          filled_size: parseFloat(fill.size || '0'),
          average_fill_price: parseFloat(fill.price || '0'),
          filled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('order_id', fill.orderId)
        .eq('user_id', userId);

      // Calculate and update position
      await this.updatePosition(fill, userId);

      console.log('[DydxOrderMonitor] Processed fill for order:', fill.orderId);
    }
  }

  /**
   * Handle subaccount balance/equity updates
   */
  private async handleSubaccountUpdate(data: any, userId: string): Promise<void> {
    console.log('[DydxOrderMonitor] Subaccount update:', data);

    // Store account snapshot
    if (data.equity && data.freeCollateral) {
      await supabase
        .from('dydx_account_snapshots')
        .insert({
          user_id: userId,
          address: data.address,
          equity: parseFloat(data.equity),
          free_collateral: parseFloat(data.freeCollateral),
          margin_usage: parseFloat(data.marginUsage || '0'),
          timestamp: new Date().toISOString()
        });
    }
  }

  /**
   * Update position based on fill data
   */
  private async updatePosition(fill: any, userId: string): Promise<void> {
    const market = fill.market;
    const side = fill.side; // BUY or SELL
    const size = parseFloat(fill.size);
    const price = parseFloat(fill.price);

    // Get existing position
    const { data: existingPosition } = await supabase
      .from('dydx_positions')
      .select('*')
      .eq('user_id', userId)
      .eq('market', market)
      .eq('status', 'OPEN')
      .maybeSingle();

    if (existingPosition) {
      // Update existing position
      const newSize = side === 'BUY' 
        ? existingPosition.size + size 
        : existingPosition.size - size;

      if (Math.abs(newSize) < 0.0001) {
        // Position closed
        await supabase
          .from('dydx_positions')
          .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
            size: 0
          })
          .eq('id', existingPosition.id);
      } else {
        // Position size changed
        await supabase
          .from('dydx_positions')
          .update({
            size: newSize,
            side: newSize > 0 ? 'LONG' : 'SHORT'
          })
          .eq('id', existingPosition.id);
      }
    }
  }

  /**
   * Attempt to reconnect on disconnect
   */
  private attemptReconnect(address: string, userId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DydxOrderMonitor] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[DydxOrderMonitor] Reconnecting... (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.start(address, userId);
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Stop monitoring and close WebSocket
   */
  stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.subscriptions.clear();
      this.isConnected = false;
      console.log('[DydxOrderMonitor] Monitor stopped');
    }
  }

  /**
   * Check if monitor is connected
   */
  isMonitorConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export const dydxOrderMonitor = new DydxOrderMonitor();
