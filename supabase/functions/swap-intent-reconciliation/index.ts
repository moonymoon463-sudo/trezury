import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting swap intent reconciliation job...');
    
    // Find stuck intents (older than 2 minutes, not completed or failed)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: stuckIntents, error: fetchError } = await supabase
      .from('transaction_intents')
      .select('*')
      .in('status', ['validating', 'funds_pulled', 'swap_executed'])
      .lt('created_at', twoMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('❌ Error fetching stuck intents:', fetchError);
      throw fetchError;
    }

    if (!stuckIntents || stuckIntents.length === 0) {
      console.log('✅ No stuck intents found');
      return new Response(
        JSON.stringify({ success: true, reconciledCount: 0, message: 'No stuck intents found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`⚠️ Found ${stuckIntents.length} stuck intents to reconcile`);

    let reconciledCount = 0;
    let refundedCount = 0;
    let failedCount = 0;

    // Process each stuck intent
    for (const intent of stuckIntents) {
      try {
        console.log(`\n🔍 Reconciling intent ${intent.id} (status: ${intent.status})`);

        // Check if transaction was actually completed in the database
        const { data: transaction } = await supabase
          .from('transactions')
          .select('*')
          .eq('quote_id', intent.quote_id)
          .eq('user_id', intent.user_id)
          .single();

        if (transaction) {
          // Transaction exists - mark intent as completed
          console.log(`✅ Found existing transaction for intent ${intent.id}`);
          await supabase
            .from('transaction_intents')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', intent.id);
          reconciledCount++;
          continue;
        }

        // No transaction found - check status
        if (intent.status === 'funds_pulled') {
          // Funds were pulled but swap didn't complete - initiate refund
          console.log(`⚠️ Intent ${intent.id} has funds pulled but no swap - attempting refund`);
          
          // Attempt to refund through blockchain-operations
          try {
            const refundResponse = await fetch(`${supabaseUrl}/functions/v1/blockchain-operations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                operation: 'refund_user',
                intentId: intent.id,
                userAddress: intent.blockchain_data?.userAddress,
                amount: intent.input_amount,
                asset: intent.input_asset
              })
            });

            if (refundResponse.ok) {
              const refundData = await refundResponse.json();
              
              // Update intent with refund information
              await supabase
                .from('transaction_intents')
                .update({
                  status: 'failed_refunded',
                  refund_tx_hash: refundData.txHash,
                  failed_at: new Date().toISOString(),
                  error_message: 'Swap failed - funds refunded to user',
                  updated_at: new Date().toISOString()
                })
                .eq('id', intent.id);
              
              refundedCount++;
              console.log(`✅ Refunded intent ${intent.id}`);
            } else {
              throw new Error('Refund request failed');
            }
          } catch (refundError) {
            console.error(`❌ Failed to refund intent ${intent.id}:`, refundError);
            
            // Mark for manual review
            await supabase
              .from('transaction_intents')
              .update({
                status: 'partial_failure',
                error_message: 'Automatic refund failed - requires manual review',
                error_details: { refundError: String(refundError) },
                updated_at: new Date().toISOString()
              })
              .eq('id', intent.id);
            
            // Create security alert for admin
            await supabase
              .from('security_alerts')
              .insert({
                alert_type: 'swap_reconciliation_failure',
                severity: 'high',
                title: 'Swap Intent Refund Failed',
                description: `Intent ${intent.id} failed automatic refund. User: ${intent.user_id}, Amount: ${intent.input_amount} ${intent.input_asset}`,
                user_id: intent.user_id,
                metadata: {
                  intent_id: intent.id,
                  quote_id: intent.quote_id,
                  pull_tx_hash: intent.pull_tx_hash,
                  amount: intent.input_amount,
                  asset: intent.input_asset,
                  error: String(refundError)
                }
              });
            
            failedCount++;
          }
        } else if (intent.status === 'validating') {
          // Stuck in validation - mark as failed
          console.log(`⚠️ Intent ${intent.id} stuck in validation - marking as failed`);
          
          await supabase
            .from('transaction_intents')
            .update({
              status: 'validation_failed',
              failed_at: new Date().toISOString(),
              error_message: 'Validation timeout - swap abandoned',
              updated_at: new Date().toISOString()
            })
            .eq('id', intent.id);
          
          failedCount++;
        } else if (intent.status === 'swap_executed') {
          // Swap executed but not recorded - mark for manual review
          console.log(`⚠️ Intent ${intent.id} shows swap executed but no DB record - requires manual review`);
          
          await supabase
            .from('transaction_intents')
            .update({
              status: 'requires_reconciliation',
              error_message: 'Swap executed on-chain but database record missing',
              updated_at: new Date().toISOString()
            })
            .eq('id', intent.id);
          
          // Create security alert
          await supabase
            .from('security_alerts')
            .insert({
              alert_type: 'swap_record_mismatch',
              severity: 'critical',
              title: 'Swap Executed But Not Recorded',
              description: `Intent ${intent.id} shows on-chain swap but missing DB record. User: ${intent.user_id}`,
              user_id: intent.user_id,
              metadata: {
                intent_id: intent.id,
                quote_id: intent.quote_id,
                swap_tx_hash: intent.swap_tx_hash,
                input_amount: intent.input_amount,
                output_asset: intent.output_asset
              }
            });
          
          failedCount++;
        }
      } catch (intentError) {
        console.error(`❌ Error reconciling intent ${intent.id}:`, intentError);
        failedCount++;
      }
    }

    const summary = {
      success: true,
      totalStuck: stuckIntents.length,
      reconciled: reconciledCount,
      refunded: refundedCount,
      failed: failedCount,
      timestamp: new Date().toISOString()
    };

    console.log('\n📊 Reconciliation Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Reconciliation job failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
