import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Background service to retry failed bridge transactions
 * This should be called periodically via cron job
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_HOURS = 1;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('[bridge-retry-service] Starting retry check...');

    // Find transactions that need retry
    const { data: failedTransactions, error: fetchError } = await supabaseClient
      .from('bridge_transactions')
      .select('*')
      .eq('status', 'pending_retry')
      .lt('created_at', new Date(Date.now() - RETRY_DELAY_HOURS * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw fetchError;
    }

    if (!failedTransactions || failedTransactions.length === 0) {
      console.log('[bridge-retry-service] No transactions to retry');
      return new Response(JSON.stringify({ 
        success: true, 
        retriedCount: 0,
        message: 'No transactions to retry'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[bridge-retry-service] Found ${failedTransactions.length} transactions to retry`);

    const results = [];

    for (const transaction of failedTransactions) {
      try {
        const metadata = transaction.metadata || {};
        const retryCount = metadata.retryCount || 0;

        // Check if exceeded max retries
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          console.log(`[bridge-retry-service] Transaction ${transaction.id} exceeded max retries, marking as failed`);
          
          await supabaseClient
            .from('bridge_transactions')
            .update({
              status: 'failed',
              error_message: `Failed after ${MAX_RETRY_ATTEMPTS} retry attempts`,
              metadata: {
                ...metadata,
                finalFailureAt: new Date().toISOString(),
              }
            })
            .eq('id', transaction.id);

          results.push({
            id: transaction.id,
            status: 'max_retries_exceeded',
          });
          continue;
        }

        // Attempt retry by calling the bridge function
        console.log(`[bridge-retry-service] Retrying transaction ${transaction.id} (attempt ${retryCount + 1})`);

        // Get user info
        const { data: userData } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('id', transaction.user_id)
          .single();

        if (!userData) {
          throw new Error('User not found');
        }

        // Check if this is an external wallet transaction
        const isExternalWallet = metadata.sourceWalletType === 'external' || metadata.externalWallet;
        
        if (isExternalWallet) {
          console.log(`[bridge-retry-service] Transaction ${transaction.id} requires external wallet - cannot auto-retry`);
          
          await supabaseClient
            .from('bridge_transactions')
            .update({
              status: 'failed',
              error_message: 'External wallet transactions cannot be automatically retried. Please initiate a new bridge transaction.',
              metadata: {
                ...metadata,
                requiresManualRetry: true,
              }
            })
            .eq('id', transaction.id);

          results.push({
            id: transaction.id,
            status: 'requires_manual_retry',
          });
          continue;
        }

        // Call bridge function to retry (internal wallets only)
        // Note: Password is not stored for security - retry will fail if password was required
        const { data: retryResult, error: retryError } = await supabaseClient.functions.invoke('hyperliquid-bridge', {
          body: {
            operation: 'execute_bridge',
            userId: transaction.user_id,
            quote: metadata.quote || {
              provider: transaction.bridge_provider,
              fromChain: transaction.source_chain,
              toChain: transaction.destination_chain,
              inputAmount: parseFloat(transaction.amount),
              estimatedOutput: parseFloat(transaction.amount) * 0.997,
              fee: parseFloat(transaction.amount) * 0.003,
              estimatedTime: '5-10min',
              route: {
                destinationAddress: metadata.destinationAddress,
                token: transaction.token,
                confirmations: 1,
              }
            },
            sourceWalletAddress: metadata.sourceWalletAddress,
            sourceWalletType: 'internal',
            // Password intentionally not included for security - user must retry manually if password is required
          },
        });

        if (retryError) {
          throw retryError;
        }

        // Update metadata with retry info
        await supabaseClient
          .from('bridge_transactions')
          .update({
            metadata: {
              ...metadata,
              retryCount: retryCount + 1,
              lastRetryAt: new Date().toISOString(),
              retryResults: [
                ...(metadata.retryResults || []),
                {
                  attempt: retryCount + 1,
                  timestamp: new Date().toISOString(),
                  success: retryResult?.success,
                  error: retryResult?.error,
                }
              ]
            }
          })
          .eq('id', transaction.id);

        results.push({
          id: transaction.id,
          status: 'retried',
          success: retryResult?.success,
        });

      } catch (error) {
        console.error(`[bridge-retry-service] Error retrying transaction ${transaction.id}:`, error);
        
        results.push({
          id: transaction.id,
          status: 'retry_failed',
          error: error.message,
        });
      }
    }

    console.log('[bridge-retry-service] Retry process completed');

    return new Response(JSON.stringify({
      success: true,
      retriedCount: failedTransactions.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[bridge-retry-service] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
