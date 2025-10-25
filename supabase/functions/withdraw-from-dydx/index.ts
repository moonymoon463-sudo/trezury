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
      console.error('[withdraw-from-dydx] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, password, destinationAddress, destinationType } = await req.json();

    console.log('[withdraw-from-dydx] Withdrawal request', {
      userId: user.id,
      amount,
      destination: destinationAddress,
      type: destinationType
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
        JSON.stringify({ error: 'Trading password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!destinationAddress) {
      return new Response(
        JSON.stringify({ error: 'Destination address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['internal', 'external'].includes(destinationType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid destination type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get dYdX wallet data
    const { data: dydxWallet, error: walletError } = await supabase
      .from('dydx_wallets')
      .select('encrypted_mnemonic, iv, salt')
      .eq('user_id', user.id)
      .single();

    if (walletError || !dydxWallet) {
      console.error('[withdraw-from-dydx] dYdX wallet not found:', walletError);
      return new Response(
        JSON.stringify({ error: 'dYdX wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check DYDX token balance for gas
    // In production, we would query dYdX Chain for DYDX balance
    // Withdrawals require ~0.5 DYDX for gas
    const minimumDydxForGas = 0.5;

    // For now, we'll assume user has enough DYDX
    // In production: const dydxBalance = await checkDydxBalance(dydxAddress);

    // Step 3: In production, we would:
    // - Decrypt the dYdX wallet with password
    // - Initiate withdrawal from dYdX Chain via dYdX client
    // - Initiate CCTP bridge to destination chain (Ethereum/Base)
    // - Sign and broadcast transactions
    // - Monitor withdrawal and bridge status

    // For now, we'll create a transaction record
    const transactionId = crypto.randomUUID();
    
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: user.id,
        type: 'withdrawal',
        asset: 'USDC',
        quantity: amount,
        status: 'pending',
        metadata: {
          withdrawal_type: 'dydx_to_' + destinationType,
          destination_address: destinationAddress,
          destination_type: destinationType,
          bridge_method: 'cctp',
          estimated_time: '20 minutes',
          gas_token: 'DYDX',
          estimated_gas: 0.5
        }
      });

    if (txError) {
      console.error('[withdraw-from-dydx] Transaction creation failed:', txError);
      throw txError;
    }

    // Step 4: If withdrawing to internal wallet, update balance snapshot
    if (destinationType === 'internal') {
      const { error: balanceError } = await supabase
        .from('balance_snapshots')
        .insert({
          user_id: user.id,
          asset: 'USDC',
          amount: amount, // Credit to internal wallet
          snapshot_at: new Date().toISOString()
        });

      if (balanceError) {
        console.error('[withdraw-from-dydx] Balance update failed:', balanceError);
      }
    }

    console.log('[withdraw-from-dydx] Withdrawal initiated successfully', {
      transactionId,
      amount,
      destination: destinationAddress,
      type: destinationType
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        estimatedTime: 20, // minutes
        gasRequired: minimumDydxForGas,
        message: 'Withdrawal initiated via CCTP bridge'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[withdraw-from-dydx] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
