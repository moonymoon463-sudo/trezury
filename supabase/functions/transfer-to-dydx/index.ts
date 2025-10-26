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
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[transfer-to-dydx] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, password, destinationAddress } = await req.json();

    console.log('[transfer-to-dydx] Transfer request', {
      userId: user.id,
      amount,
      destination: destinationAddress
    });

    // Validate inputs
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!destinationAddress) {
      return new Response(
        JSON.stringify({ error: 'Destination address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get encrypted wallet data
    const { data: walletData, error: walletError } = await supabase
      .from('encrypted_wallet_keys')
      .select('encrypted_private_key, encryption_iv, encryption_salt')
      .eq('user_id', user.id)
      .single();

    if (walletError || !walletData) {
      console.error('[transfer-to-dydx] Wallet not found:', walletError);
      return new Response(
        JSON.stringify({ error: 'Internal wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[transfer-to-dydx] Wallet found, initiating transfer', {
      userId: user.id,
      amount,
      destination: destinationAddress,
      hasEncryptedKey: !!walletData.encrypted_private_key
    });

    // MVP Mock Flow: Create transaction record
    // TODO: Implement real CCTP bridge + wallet decryption
    const transactionId = crypto.randomUUID();
    
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: user.id,
        type: 'transfer',
        asset: 'USDC',
        quantity: amount,
        status: 'processing',
        metadata: {
          transfer_type: 'internal_to_dydx',
          destination_address: destinationAddress,
          bridge_method: 'cctp_mock',
          estimated_time: '20 minutes',
          note: 'MVP mock flow - real bridging not yet implemented'
        }
      });

    if (txError) {
      console.error('[transfer-to-dydx] Transaction creation failed:', txError);
      throw txError;
    }

    // Step 3: Update balance snapshot (deduct from internal wallet)
    const { error: balanceError } = await supabase
      .from('balance_snapshots')
      .insert({
        user_id: user.id,
        asset: 'USDC',
        amount: -amount,
        snapshot_at: new Date().toISOString()
      });

    if (balanceError) {
      console.error('[transfer-to-dydx] Balance update failed:', balanceError);
    }

    console.log('[transfer-to-dydx] Transfer initiated successfully', {
      transactionId,
      amount,
      destination: destinationAddress
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        estimatedTime: 20,
        status: 'processing',
        message: 'Transfer initiated - funds will be bridged to dYdX Chain'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[transfer-to-dydx] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
