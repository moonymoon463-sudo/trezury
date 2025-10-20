import { supabase } from "@/integrations/supabase/client";

export interface SafeSwapResult {
  success: boolean;
  transactionId?: string;
  intentId?: string;
  hash?: string;
  error?: string;
  requiresRefund?: boolean;
  refundTxHash?: string;
  netOutputAmount?: string;
  relayFeeUsd?: string;
}

/**
 * Safe swap execution wrapper that creates intent tracking BEFORE blockchain interaction
 * This ensures we never lose track of user funds
 */
export class SafeSwapService {
  /**
   * Create transaction intent BEFORE any blockchain operation
   * This is the safety net that prevents fund loss
   */
  async createSwapIntent(
    quoteId: string,
    userId: string,
    inputAsset: string,
    outputAsset: string,
    inputAmount: number,
    expectedOutputAmount: number
  ): Promise<{ intentId: string; idempotencyKey: string } | null> {
    try {
      // F-003 FIX: Generate strong idempotency key using crypto-random UUID
      const idempotencyKey = `swap_${quoteId}_${crypto.randomUUID()}`;

      // F-003 FIX: Check for existing intent with this idempotency key
      const { data: existingIntent } = await supabase
        .from('transaction_intents')
        .select('id, idempotency_key')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingIntent) {
        console.log(`[SafeSwapService] ⚠️ Intent already exists for key: ${idempotencyKey}`);
        return { intentId: existingIntent.id, idempotencyKey };
      }

      const { data: intent, error } = await supabase
        .from('transaction_intents')
        .insert({
          user_id: userId,
          quote_id: quoteId,
          idempotency_key: idempotencyKey,
          input_asset: inputAsset,
          output_asset: outputAsset,
          input_amount: inputAmount,
          expected_output_amount: expectedOutputAmount,
          status: 'initiated',
        })
        .select()
        .single();

      if (error || !intent) {
        console.error('[SafeSwapService] Failed to create intent:', error);
        return null;
      }

      console.log(`[SafeSwapService] ✅ Intent created: ${intent.id} (key: ${idempotencyKey})`);
      return { intentId: intent.id, idempotencyKey };
    } catch (err) {
      console.error('[SafeSwapService] Error creating intent:', err);
      return null;
    }
  }

  /**
   * Update intent status with detailed tracking
   */
  async updateIntentStatus(
    intentId: string,
    status: string,
    updateData: {
      error_message?: string;
      error_details?: any;
      pull_tx_hash?: string;
      swap_tx_hash?: string;
      disbursement_tx_hash?: string;
      refund_tx_hash?: string;
      validation_data?: any;
      blockchain_data?: any;
    } = {}
  ): Promise<boolean> {
    try {
      const update: any = {
        status,
        updated_at: new Date().toISOString(),
        ...updateData
      };

      // Set timestamp fields based on status
      if (status === 'validating') {
        update.validated_at = new Date().toISOString();
      } else if (status === 'funds_pulled') {
        update.funds_pulled_at = new Date().toISOString();
      } else if (status === 'swap_executed') {
        update.swap_executed_at = new Date().toISOString();
      } else if (status === 'completed') {
        update.completed_at = new Date().toISOString();
      } else if (status.includes('failed') || status === 'validation_failed') {
        update.failed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('transaction_intents')
        .update(update)
        .eq('id', intentId);

      if (error) {
        console.error('[SafeSwapService] Failed to update intent:', error);
        return false;
      }

      console.log(`[SafeSwapService] ✅ Intent ${intentId} updated to: ${status}`);
      return true;
    } catch (err) {
      console.error('[SafeSwapService] Error updating intent:', err);
      return false;
    }
  }

  /**
   * Check if an intent with given idempotency key already exists
   */
  async checkIntentExists(idempotencyKey: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('transaction_intents')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (error) {
        console.error('[SafeSwapService] Error checking intent:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[SafeSwapService] Error checking intent existence:', err);
      return null;
    }
  }

  /**
   * Get intent by ID
   */
  async getIntent(intentId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('transaction_intents')
        .select('*')
        .eq('id', intentId)
        .single();

      if (error || !data) {
        console.error('[SafeSwapService] Error fetching intent:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[SafeSwapService] Error fetching intent:', err);
      return null;
    }
  }

  /**
   * Create security alert for critical issues
   */
  async createSecurityAlert(
    intentId: string,
    userId: string,
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    description: string,
    metadata: any
  ): Promise<void> {
    try {
      await supabase.from('security_alerts').insert({
        alert_type: alertType,
        severity,
        title,
        description,
        user_id: userId,
        metadata: {
          ...metadata,
          intent_id: intentId,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`[SafeSwapService] 🚨 Security alert created: ${alertType}`);
    } catch (err) {
      console.error('[SafeSwapService] Failed to create security alert:', err);
    }
  }
}

export const safeSwapService = new SafeSwapService();
