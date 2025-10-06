import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('🔄 Starting MoonPay transaction sync...');

    // Get all unsynced MoonPay payment transactions
    const { data: paymentTxs, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('provider', 'moonpay')
      .eq('status', 'completed')
      .or('last_sync_at.is.null,last_sync_at.lt.' + new Date(Date.now() - 3600000).toISOString());

    if (fetchError) {
      console.error('Error fetching payment transactions:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${paymentTxs?.length || 0} MoonPay transactions to sync`);

    let syncedCount = 0;
    let errorCount = 0;

    for (const paymentTx of paymentTxs || []) {
      try {
        // Check if already synced
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('metadata->>moonpay_tx_id', paymentTx.external_id)
          .single();

        if (existing) {
          console.log(`⏭️ Skipping already synced: ${paymentTx.external_id}`);
          continue;
        }

        // Determine transaction type from metadata
        const txType = (paymentTx.metadata as any)?.transaction_type || 'buy';
        
        // Create corresponding transaction record
        const { error: insertError } = await supabase
          .from('transactions')
          .insert({
            user_id: paymentTx.user_id,
            type: txType,
            asset: paymentTx.currency,
            quantity: paymentTx.amount,
            unit_price_usd: 1, // MoonPay amounts are already in fiat
            fee_usd: 0, // MoonPay fees are included in their amounts
            status: 'completed',
            input_asset: (paymentTx.metadata as any)?.currency_fiat || 'USD',
            output_asset: paymentTx.currency,
            metadata: {
              moonpay_tx_id: paymentTx.external_id,
              moonpay_synced: true,
              synced_at: new Date().toISOString(),
              original_payment_tx_id: paymentTx.id,
              ...paymentTx.metadata
            }
          });

        if (insertError) {
          console.error(`❌ Error syncing ${paymentTx.external_id}:`, insertError);
          errorCount++;
          continue;
        }

        // Update last_sync_at
        await supabase
          .from('payment_transactions')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', paymentTx.id);

        console.log(`✅ Synced MoonPay transaction: ${paymentTx.external_id}`);
        syncedCount++;
      } catch (err) {
        console.error(`❌ Error processing ${paymentTx.external_id}:`, err);
        errorCount++;
      }
    }

    console.log(`🎉 Sync complete: ${syncedCount} synced, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        errors: errorCount,
        total: paymentTxs?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
