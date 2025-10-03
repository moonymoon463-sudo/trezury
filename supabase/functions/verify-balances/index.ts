import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WalletAddress {
  id: string;
  user_id: string;
  address: string;
  asset: string;
  chain: string;
}

interface BalanceMismatch {
  user_id: string;
  address: string;
  asset: string;
  db_balance: number;
  chain_balance: number;
  difference: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Starting balance verification cron job...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all unique user wallet addresses
    const { data: addresses, error: addressError } = await supabaseAdmin
      .from('onchain_addresses')
      .select('id, user_id, address, asset, chain');

    if (addressError) {
      console.error('❌ Failed to fetch wallet addresses:', addressError);
      throw addressError;
    }

    console.log(`📊 Checking ${addresses?.length || 0} wallet addresses...`);

    const mismatches: BalanceMismatch[] = [];
    let checkedCount = 0;
    let matchedCount = 0;

    // Check each address
    for (const wallet of (addresses as WalletAddress[]) || []) {
      try {
        // Get database balance from balance_snapshots
        const { data: snapshots, error: snapshotError } = await supabaseAdmin
          .from('balance_snapshots')
          .select('amount')
          .eq('user_id', wallet.user_id)
          .eq('asset', wallet.asset);

        if (snapshotError) {
          console.error(`❌ Error fetching snapshots for user ${wallet.user_id}:`, snapshotError);
          continue;
        }

        const dbBalance = (snapshots || []).reduce((sum, s) => sum + Number(s.amount), 0);

        // Get on-chain balance
        const { data: chainData, error: chainError } = await supabaseAdmin.functions.invoke(
          'blockchain-operations',
          {
            body: {
              operation: 'get_balance',
              address: wallet.address,
              asset: wallet.asset,
            },
          }
        );

        if (chainError) {
          console.error(`❌ Blockchain query failed for ${wallet.address}:`, chainError);
          continue;
        }

        const chainBalance = Number(chainData?.balance || 0);
        const difference = Math.abs(dbBalance - chainBalance);

        checkedCount++;

        // Alert on mismatch > $1 equivalent
        if (difference > 1) {
          console.warn(`⚠️ Mismatch detected for user ${wallet.user_id}: DB=${dbBalance}, Chain=${chainBalance}`);
          
          mismatches.push({
            user_id: wallet.user_id,
            address: wallet.address,
            asset: wallet.asset,
            db_balance: dbBalance,
            chain_balance: chainBalance,
            difference,
          });

          // Create security alert
          await supabaseAdmin.from('security_alerts').insert({
            user_id: wallet.user_id,
            alert_type: 'balance_mismatch',
            severity: difference > 100 ? 'high' : 'medium',
            title: 'Balance Reconciliation Required',
            description: `Database balance (${dbBalance} ${wallet.asset}) differs from on-chain balance (${chainBalance} ${wallet.asset}) by ${difference.toFixed(2)}`,
            metadata: {
              address: wallet.address,
              asset: wallet.asset,
              db_balance: dbBalance,
              chain_balance: chainBalance,
              difference,
              chain: wallet.chain,
            },
          });

          // Create reconciliation record
          await supabaseAdmin.from('balance_reconciliations').insert({
            user_id: wallet.user_id,
            address: wallet.address,
            asset: wallet.asset,
            db_balance: dbBalance,
            chain_balance: chainBalance,
            difference,
            status: 'pending_review',
            detected_at: new Date().toISOString(),
          });
        } else {
          matchedCount++;
        }
      } catch (error) {
        console.error(`❌ Error checking wallet ${wallet.address}:`, error);
      }
    }

    const summary = {
      total_checked: checkedCount,
      matched: matchedCount,
      mismatches: mismatches.length,
      details: mismatches,
      timestamp: new Date().toISOString(),
    };

    console.log(`✅ Balance verification complete: ${matchedCount}/${checkedCount} matched`);
    if (mismatches.length > 0) {
      console.warn(`⚠️ Found ${mismatches.length} balance mismatches requiring reconciliation`);
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Balance verification failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
