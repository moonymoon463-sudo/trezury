import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { txHash, routeId, amount, destinationChain, destinationAddress } = await req.json();

    console.log('[record-skip-withdrawal] Recording withdrawal', {
      userId: user.id,
      txHash,
      routeId,
      amount
    });

    // Record withdrawal transaction
    const transactionId = crypto.randomUUID();
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: user.id,
        type: 'withdrawal',
        asset: 'USDC',
        quantity: amount,
        status: 'completed',
        tx_hash: txHash,
        metadata: {
          withdrawal_type: 'dydx_to_external',
          destination_address: destinationAddress,
          destination_chain: destinationChain,
          bridge_method: 'skip_go_widget',
          skip_route_id: routeId,
          completed_at: new Date().toISOString()
        }
      });

    if (txError) {
      console.error('[record-skip-withdrawal] Transaction record failed:', txError);
      throw txError;
    }

    console.log('[record-skip-withdrawal] Withdrawal recorded:', transactionId);

    return new Response(
      JSON.stringify({
        success: true,
        transactionId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[record-skip-withdrawal] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
