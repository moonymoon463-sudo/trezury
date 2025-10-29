/**
 * Synthetix Trading Service
 * Routes trades to internal wallet (server-side) or external wallet (client-side)
 */

import { ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';
import { snxPerpsClient } from '@/lib/snx/perpsClient';
import type {
  SnxAccount,
  SnxPosition,
  SnxOrder,
  SnxTradeRequest,
  SnxTradeResponse,
  SnxOrderDB,
  SnxPositionDB,
  LeverageValidation,
  MarginInfo
} from '@/types/snx';

type WalletSource = 'internal' | 'external';

class SnxTradingService {
  private cache = new Map<string, { data: any; expires: number }>();

  // ========== Account Management ==========

  async getAccountInfo(accountId: bigint, chainId: number = 8453): Promise<SnxAccount> {
    const client = new (await import('@/lib/snx/perpsClient')).SynthetixPerpsClient(chainId);
    return await client.getAccount(accountId);
  }

  async getAccountId(userId: string, chainId: number): Promise<bigint | null> {
    // Check if user has an account ID for this chain
    const { data, error } = await supabase
      .from('snx_accounts')
      .select('account_id')
      .eq('user_id', userId)
      .eq('chain_id', chainId)
      .single();

    if (error || !data) {
      return null;
    }

    return BigInt(data.account_id);
  }

  // ========== Position Management ==========

  async getOpenPositions(accountId: bigint, chainId: number = 8453): Promise<SnxPosition[]> {
    const { data: dbPositions, error } = await supabase
      .from('snx_positions')
      .select('*')
      .eq('account_id', accountId.toString())
      .eq('status', 'OPEN')
      .eq('chain_id', chainId);

    if (error || !dbPositions) {
      return [];
    }

    const client = new (await import('@/lib/snx/perpsClient')).SynthetixPerpsClient(chainId);
    const positions: SnxPosition[] = [];

    for (const dbPos of dbPositions) {
      const position = await client.getPosition(accountId, dbPos.market_key);
      if (position) {
        positions.push(position);
      }
    }

    return positions;
  }

  async closePosition(
    accountId: bigint,
    marketKey: string,
    walletSource: WalletSource,
    password?: string,
    chainId: number = 8453
  ): Promise<SnxTradeResponse> {
    const client = new (await import('@/lib/snx/perpsClient')).SynthetixPerpsClient(chainId);
    const position = await client.getPosition(accountId, marketKey);

    if (!position) {
      return {
        success: false,
        error: 'Position not found'
      };
    }

    // Close = opposite side with same size
    const tradeRequest: SnxTradeRequest = {
      marketKey,
      side: position.side === 'LONG' ? 'SELL' : 'BUY',
      type: 'MARKET',
      size: position.size,
      leverage: 1, // Doesn't matter for closing
      reduceOnly: true
    };

    return this.placeTrade(tradeRequest, walletSource, chainId, password);
  }

  // ========== Trading ==========

  async placeTrade(
    request: SnxTradeRequest,
    walletSource: WalletSource,
    chainId: number = 8453,
    password?: string
  ): Promise<SnxTradeResponse> {
    try {
      if (walletSource === 'internal') {
        return await this.placeTradeInternal(request, chainId, password!);
      } else {
        return await this.placeTradeExternal(request, chainId);
      }
    } catch (error) {
      console.error('[SnxTradingService] Trade failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Trade failed'
      };
    }
  }

  private async placeTradeInternal(
    request: SnxTradeRequest,
    chainId: number,
    password: string
  ): Promise<SnxTradeResponse> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Call edge function to execute trade server-side
    const { data, error } = await supabase.functions.invoke('snx-trade-executor', {
      body: {
        request,
        chainId,
        password
      }
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return data as SnxTradeResponse;
  }

  private async placeTradeExternal(
    request: SnxTradeRequest,
    chainId: number
  ): Promise<SnxTradeResponse> {
    if (!window.ethereum) {
      return { success: false, error: 'No wallet detected' };
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Ensure correct network
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== chainId) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }]
        });
      }

      const client = new (await import('@/lib/snx/perpsClient')).SynthetixPerpsClient(chainId);
      
      // Get account ID (user must have one)
      const address = await signer.getAddress();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const accountId = await this.getAccountId(user.id, chainId);
      if (!accountId) {
        return { success: false, error: 'No trading account found. Create one first.' };
      }

      // Get market info
      const { getMarketInfo } = await import('@/config/snxAddresses');
      const market = getMarketInfo(chainId, request.marketKey);

      // Calculate size delta (positive for long, negative for short)
      const sizeDelta = request.side === 'BUY' ? request.size : -request.size;

      // Get acceptable price (with slippage)
      const currentPrice = await client.getPrice(request.marketKey);
      const slippageBps = request.slippageBps || 50; // 0.5% default
      const acceptablePrice = request.side === 'BUY'
        ? currentPrice * (1 + slippageBps / 10000)
        : currentPrice * (1 - slippageBps / 10000);

      // Build transaction
      const tx = await client.buildTradeTx({
        accountId: accountId,
        marketId: BigInt(market.marketId),
        sizeDelta,
        acceptablePrice,
        trackingCode: ethers.id('trezury-v1').slice(0, 66) as `0x${string}`
      });

      // Execute
      const receipt = await client.submitTradeTx(signer, tx);

      // Record in database
      const order: Partial<SnxOrderDB> = {
        user_id: user.id,
        account_id: accountId.toString(),
        market_id: market.marketId.toString(),
        market_key: market.marketKey,
        type: request.type,
        side: request.side,
        size: request.size,
        leverage: request.leverage,
        price: request.price,
        status: 'FILLED',
        filled_size: request.size,
        filled_price: currentPrice,
        tx_hash: receipt.hash,
        chain_id: chainId,
        wallet_source: 'external'
      };

      await supabase.from('snx_orders').insert(order);

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error) {
      console.error('[SnxTradingService] External trade failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Trade failed'
      };
    }
  }

  // ========== Order Management ==========

  async getOrderHistory(userId: string, limit: number = 50): Promise<SnxOrder[]> {
    const { data, error } = await supabase
      .from('snx_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbOrderToOrder);
  }

  private mapDbOrderToOrder(dbOrder: SnxOrderDB): SnxOrder {
    return {
      id: dbOrder.id,
      accountId: BigInt(dbOrder.account_id),
      marketId: BigInt(dbOrder.market_id),
      marketKey: dbOrder.market_key,
      type: dbOrder.type,
      side: dbOrder.side,
      size: dbOrder.size,
      leverage: dbOrder.leverage,
      price: dbOrder.price,
      status: dbOrder.status,
      filledSize: dbOrder.filled_size,
      filledPrice: dbOrder.filled_price,
      txHash: dbOrder.tx_hash,
      createdAt: new Date(dbOrder.created_at).getTime(),
      filledAt: dbOrder.filled_at ? new Date(dbOrder.filled_at).getTime() : undefined
    };
  }

  // ========== Risk Management ==========

  async validateLeverage(marketKey: string, leverage: number, chainId: number = 8453): Promise<LeverageValidation> {
    const client = new (await import('@/lib/snx/perpsClient')).SynthetixPerpsClient(chainId);
    return await client.validateLeverage(marketKey, leverage);
  }

  async calculateMarginRequirement(
    size: number,
    leverage: number,
    marketKey: string,
    chainId: number = 8453
  ): Promise<MarginInfo> {
    const client = new (await import('@/lib/snx/perpsClient')).SynthetixPerpsClient(chainId);
    const price = await client.getPrice(marketKey);
    return await client.calculateMarginRequirement(size, leverage, price);
  }

  // ========== Utilities ==========

  private getCacheKey(key: string): string {
    return `snx_${key}`;
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(this.getCacheKey(key));
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(this.getCacheKey(key), {
      data,
      expires: Date.now() + ttlSeconds * 1000
    });
  }
}

export const snxTradingService = new SnxTradingService();
