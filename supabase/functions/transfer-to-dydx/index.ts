import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Skip Go API endpoint
const SKIP_API_URL = 'https://api.skip.build/v2/fungible/route';

// USDC on Ethereum Mainnet
const ETHEREUM_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
// USDC on dYdX Chain (IBC denom)
const DYDX_USDC = 'ibc/8E27BA2D5493AF5636760E354E46004562C46AB7EC0CC4C1CA14E9E20E2545B5';

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
      console.error('[transfer-to-dydx] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, password, destinationAddress } = await req.json();

    console.log('[transfer-to-dydx] Skip Go deposit request', {
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

    if (!destinationAddress || !destinationAddress.startsWith('dydx1')) {
      return new Response(
        JSON.stringify({ error: 'Invalid dYdX address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get Skip route quote
    console.log('[transfer-to-dydx] Fetching Skip route...');
    const amountInBaseUnits = Math.floor(amount * 1_000_000).toString(); // USDC has 6 decimals

    const routeResponse = await fetch(SKIP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_in: amountInBaseUnits,
        source_asset_denom: ETHEREUM_USDC,
        source_asset_chain_id: '1', // Ethereum mainnet
        dest_asset_denom: DYDX_USDC,
        dest_asset_chain_id: 'dydx-mainnet-1',
        cumulative_affiliate_fee_bps: '0',
        allow_multi_tx: false,
        smart_relay: true
      })
    });

    if (!routeResponse.ok) {
      const errorText = await routeResponse.text();
      console.error('[transfer-to-dydx] Skip route failed:', errorText);
      throw new Error('Failed to get bridge route from Skip');
    }

    const route = await routeResponse.json();
    
    if (!route.txs || route.txs.length === 0 || !route.txs[0].evm_tx) {
      console.error('[transfer-to-dydx] Invalid route response:', route);
      throw new Error('Invalid route from Skip - no EVM transaction');
    }

    console.log('[transfer-to-dydx] Skip route obtained', {
      routeId: route.route_id,
      estimatedTime: route.estimated_route_duration_seconds,
      fees: route.estimated_fees
    });

    // Step 2: Get encrypted wallet data
    const { data: walletData, error: walletError } = await supabase
      .from('encrypted_wallet_keys')
      .select('encrypted_private_key, encryption_iv, encryption_salt')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletError || !walletData) {
      console.error('[transfer-to-dydx] Wallet not found:', walletError);
      return new Response(
        JSON.stringify({ error: 'Internal wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Decrypt wallet (using Web Crypto API in Deno)
    const decryptedKey = await decryptPrivateKey(
      walletData.encrypted_private_key,
      walletData.encryption_iv,
      walletData.encryption_salt,
      password
    );

    // Step 4: Import ethers via CDN
    const { ethers } = await import('https://esm.sh/ethers@6.13.0');
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    const wallet = new ethers.Wallet(decryptedKey, provider);

    console.log('[transfer-to-dydx] Wallet loaded:', wallet.address);

    // Step 5: Execute Skip transaction
    const evmTx = route.txs[0].evm_tx;
    const tx = await wallet.sendTransaction({
      to: evmTx.to,
      data: evmTx.data,
      value: evmTx.value || '0',
      gasLimit: evmTx.gas_limit || '500000'
    });

    console.log('[transfer-to-dydx] Transaction sent:', tx.hash);

    // Step 6: Record transaction in database
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
        tx_hash: tx.hash,
        metadata: {
          transfer_type: 'internal_to_dydx',
          destination_address: destinationAddress,
          bridge_method: 'skip_go',
          skip_route_id: route.route_id,
          estimated_time_seconds: route.estimated_route_duration_seconds,
          estimated_fees: route.estimated_fees,
          source_chain: 'ethereum',
          dest_chain: 'dydx'
        }
      });

    if (txError) {
      console.error('[transfer-to-dydx] Transaction record failed:', txError);
    }

    // Step 7: Update balance snapshot (deduct from internal wallet)
    await supabase
      .from('balance_snapshots')
      .insert({
        user_id: user.id,
        asset: 'USDC',
        amount: -amount,
        snapshot_at: new Date().toISOString()
      });

    console.log('[transfer-to-dydx] Deposit initiated via Skip Go', {
      transactionId,
      txHash: tx.hash,
      routeId: route.route_id
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        txHash: tx.hash,
        routeId: route.route_id,
        estimatedTime: Math.ceil(route.estimated_route_duration_seconds / 60),
        trackingUrl: `https://track.skip.build/${route.route_id}`,
        message: 'Deposit initiated via Skip Go bridge'
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

// Decrypt private key using PBKDF2 + AES-GCM
async function decryptPrivateKey(
  encryptedHex: string,
  ivHex: string,
  salt: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt
  const encrypted = hexToUint8Array(encryptedHex);
  const iv = hexToUint8Array(ivHex);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
