import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🔄 Starting transaction reconciliation...');

    // Get all unreconciled failed transaction records
    const { data: failedRecords, error: fetchError } = await supabaseClient
      .from('failed_transaction_records')
      .select('*')
      .eq('reconciled', false)
      .order('created_at', { ascending: true })
      .limit(10); // Process 10 at a time

    if (fetchError) {
      throw new Error(`Failed to fetch records: ${fetchError.message}`);
    }

    if (!failedRecords || failedRecords.length === 0) {
      console.log('✅ No failed transactions to reconcile');
      return new Response(
        JSON.stringify({ message: 'No records to reconcile', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${failedRecords.length} records to reconcile`);

    let reconciledCount = 0;
    const errors: any[] = [];

    for (const record of failedRecords) {
      try {
        console.log(`🔧 Reconciling transaction: ${record.tx_hash}`);

        const swapData = record.swap_data;
        
        // Create the missing transaction record
        const { data: transaction, error: txError } = await supabaseClient
          .from('transactions')
          .insert({
            user_id: record.user_id,
            quote_id: record.quote_id,
            type: 'swap',
            asset: swapData.outputAsset,
            quantity: swapData.outputAmount,
            unit_price_usd: swapData.exchangeRate || 0,
            fee_usd: swapData.inputAmount * 0.008, // 0.8% fee
            status: 'completed',
            input_asset: swapData.inputAsset,
            output_asset: swapData.outputAsset,
            tx_hash: record.tx_hash,
            metadata: {
              ...swapData.swapResult,
              reconciled: true,
              reconciledAt: new Date().toISOString(),
              originalFailureReason: record.error_message
            }
          })
          .select()
          .single();

        if (txError) {
          throw new Error(`Transaction insert failed: ${txError.message}`);
        }

        console.log(`✅ Created transaction record: ${transaction.id}`);

        // Mark as reconciled
        const { error: updateError } = await supabaseClient
          .from('failed_transaction_records')
          .update({
            reconciled: true,
            reconciled_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (updateError) {
          console.warn(`⚠️ Failed to mark as reconciled: ${updateError.message}`);
        }

        reconciledCount++;
        console.log(`✅ Successfully reconciled ${record.tx_hash}`);

      } catch (err) {
        console.error(`❌ Failed to reconcile ${record.tx_hash}:`, err);
        errors.push({
          recordId: record.id,
          txHash: record.tx_hash,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const result = {
      message: 'Reconciliation completed',
      processed: failedRecords.length,
      reconciled: reconciledCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('🎉 Reconciliation summary:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Reconciliation error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});