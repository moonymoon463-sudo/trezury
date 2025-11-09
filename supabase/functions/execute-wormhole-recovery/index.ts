import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, password, forensicsResults } = await req.json();

    if (!userId || !password || !forensicsResults) {
      return new Response(
        JSON.stringify({ error: 'userId, password, and forensicsResults required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔓 Starting Wormhole recovery for user ${userId}`);

    const wormholeTransactions = forensicsResults.filter(
      (r: any) => r.provider === 'wormhole' && r.needsRedemption && r.vaaBytes
    );

    if (wormholeTransactions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No Wormhole transactions need redemption',
          redeemed: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${wormholeTransactions.length} Wormhole transactions to redeem`);

    const redemptionResults = [];

    // Redeem each VAA
    for (const tx of wormholeTransactions) {
      console.log(`\n🔄 Redeeming ${tx.amount} USDC from ${tx.txHash}...`);
      
      try {
        // Call redeem-wormhole-vaa function
        const { data: redeemData, error: redeemError } = await supabaseClient.functions.invoke(
          'redeem-wormhole-vaa',
          {
            body: {
              userId,
              password,
              vaaBytes: tx.vaaBytes
            }
          }
        );

        if (redeemError) throw redeemError;

        if (redeemData.success) {
          console.log(`✅ Redeemed: ${redeemData.txHash}`);
          
          // Try to match with database record by amount and update
          const { data: dbRecords } = await supabaseClient
            .from('bridge_transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .gte('amount', parseFloat(tx.amount) - 0.1)
            .lte('amount', parseFloat(tx.amount) + 0.1)
            .limit(1);

          if (dbRecords && dbRecords.length > 0) {
            await supabaseClient
              .from('bridge_transactions')
              .update({
                source_tx_hash: tx.txHash,
                destination_tx_hash: redeemData.txHash,
                status: 'step1_complete',
                metadata: {
                  wormhole_redeemed: true,
                  redemption_block: redeemData.blockNumber,
                  arbitrum_arrived: true,
                  sequence: tx.sequence,
                  emitter: tx.emitterAddress
                }
              })
              .eq('id', dbRecords[0].id);
            
            console.log(`✅ Updated bridge record ${dbRecords[0].id}`);
          }

          redemptionResults.push({
            txHash: tx.txHash,
            amount: tx.amount,
            redemptionTxHash: redeemData.txHash,
            success: true
          });
        } else {
          console.log(`❌ Redemption failed: ${redeemData.error}`);
          redemptionResults.push({
            txHash: tx.txHash,
            amount: tx.amount,
            error: redeemData.error,
            success: false
          });
        }
      } catch (error) {
        console.error(`❌ Error redeeming ${tx.txHash}:`, error);
        redemptionResults.push({
          txHash: tx.txHash,
          amount: tx.amount,
          error: error.message,
          success: false
        });
      }
    }

    const successCount = redemptionResults.filter(r => r.success).length;
    const totalRedeemed = redemptionResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    console.log(`\n✅ Recovery complete: ${successCount}/${wormholeTransactions.length} transactions redeemed`);
    console.log(`💰 Total recovered: ${totalRedeemed.toFixed(2)} USDC`);

    return new Response(
      JSON.stringify({
        success: true,
        redeemed: redemptionResults,
        summary: {
          total_transactions: wormholeTransactions.length,
          successful_redemptions: successCount,
          failed_redemptions: wormholeTransactions.length - successCount,
          total_usdc_recovered: totalRedeemed.toFixed(2)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Recovery error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
