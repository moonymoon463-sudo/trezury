// Transfer USDC between wallets using Squid Router v2 (Hyperliquid L1)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const isDev = Deno.env.get("ENV") !== "production";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

// Squid Router API endpoint
const SQUID_API_URL = 'https://v2.api.squidrouter.com/v2/route';
const SQUID_INTEGRATOR_ID = 'squid-swap-widget';

// USDC on Ethereum Mainnet
const ETHEREUM_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
// USDC on Hyperliquid L1 (Arbitrum)
const HYPERLIQUID_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // USDC on Arbitrum

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get('operation') === 'ping') {
      return new Response(
        JSON.stringify({ ok: true, timestamp: Date.now(), service: 'transfer-between-wallets' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[transfer-between-wallets] Auth error:', authError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Authentication required', error: 'Unauthorized' }),
        { status: isDev ? 200 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, password, destinationAddress } = await req.json();

    console.log('[transfer-between-wallets] Transfer request', {
      userId: user.id,
      amount,
      destination: destinationAddress
    });

    // Validate inputs
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Invalid amount', error: 'INVALID_AMOUNT' }),
        { status: isDev ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Password required', error: 'PASSWORD_REQUIRED' }),
        { status: isDev ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate EVM address (0x...)
    if (!destinationAddress || !/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Invalid EVM address', error: 'INVALID_ADDRESS' }),
        { status: isDev ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get encrypted wallet data
    const { data: walletData, error: walletError } = await supabase
      .from('encrypted_wallet_keys')
      .select('encrypted_private_key, encryption_iv, encryption_salt')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletError || !walletData) {
      console.error('[transfer-between-wallets] Wallet not found:', walletError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Internal wallet not found', error: 'NO_WALLET' }),
        { status: isDev ? 200 : 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt wallet
    console.log('[transfer-between-wallets] Decrypting wallet');
    let decryptedKey: string;
    
    try {
      decryptedKey = await decryptPrivateKey(
        walletData.encrypted_private_key,
        walletData.encryption_iv,
        walletData.encryption_salt,
        password
      );
      console.log('[transfer-between-wallets] ✅ Password-based decryption succeeded');
    } catch (error) {
      console.warn('[transfer-between-wallets] Password decryption failed:', error.message);
      
      try {
        decryptedKey = await decryptPrivateKey(
          walletData.encrypted_private_key,
          walletData.encryption_iv,
          walletData.encryption_salt,
          user.id
        );
        console.log('[transfer-between-wallets] ✅ Legacy userId decryption succeeded');
      } catch (legacyError) {
        console.error('[transfer-between-wallets] Both decryption methods failed');
        
        return new Response(
          JSON.stringify({ 
            ok: false,
            message: 'Invalid wallet password',
            error: 'WALLET_DECRYPTION_FAILED',
          }),
          { status: isDev ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Import ethers
    const { ethers } = await import('https://esm.sh/ethers@6.13.0');
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    const wallet = new ethers.Wallet(decryptedKey, provider);

    console.log('[transfer-between-wallets] Wallet loaded:', wallet.address);

    // Get Squid route (Ethereum → Hyperliquid L1 via Arbitrum)
    console.log('[transfer-between-wallets] Fetching route from Squid Router API');
    const amountInBaseUnits = Math.floor(amount * 1_000_000).toString();

    let routeResponse;
    try {
      routeResponse = await fetch(SQUID_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-integrator-id': SQUID_INTEGRATOR_ID,
        },
        body: JSON.stringify({
          integratorId: SQUID_INTEGRATOR_ID,
          fromChain: "1",  // Ethereum mainnet
          fromToken: ETHEREUM_USDC,
          fromAmount: amountInBaseUnits,
          fromAddress: wallet.address,
          toChain: "42161", // Arbitrum (Hyperliquid L1)
          toToken: HYPERLIQUID_USDC,
          toAddress: destinationAddress,
          slippage: 1.0,
          enableForecall: true,
          quoteOnly: false
        }),
      });
    } catch (fetchError: any) {
      if (fetchError.message?.includes('dns error')) {
        console.error('[transfer-between-wallets] DNS resolution failed');
        return new Response(
          JSON.stringify({
            ok: false,
            message: 'Unable to reach bridging service',
            error: 'SQUID_API_UNREACHABLE',
          }),
          { status: isDev ? 200 : 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

    if (!routeResponse.ok) {
      const errorData = await routeResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('[transfer-between-wallets] Squid API error:', errorData);
      
      return new Response(
        JSON.stringify({ 
          ok: false,
          message: errorData.message || 'Failed to get bridge route',
          error: 'SQUID_ROUTE_ERROR',
        }),
        { status: isDev ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = await routeResponse.json();
    console.log('[transfer-between-wallets] Squid route received');

    const txRequest = route.route?.transactionRequest;
    if (!txRequest) {
      console.error('[transfer-between-wallets] No transactionRequest in route');
      throw new Error('No executable transaction returned from Squid API');
    }

    // Execute transaction
    console.log('[transfer-between-wallets] Executing transaction');
    
    let gelatoResponse;
    try {
      const tx = await wallet.sendTransaction({
        to: txRequest.target || txRequest.targetAddress,
        data: txRequest.data,
        value: txRequest.value || '0',
        gasLimit: txRequest.gasLimit || 500000,
      });
      
      console.log('[transfer-between-wallets] Transaction sent:', tx.hash);
      await tx.wait();
      console.log('[transfer-between-wallets] Transaction confirmed:', tx.hash);
      
      gelatoResponse = { taskId: tx.hash };
    } catch (txError: any) {
      console.error('[transfer-between-wallets] Transaction execution failed:', txError);
      const errorMsg = txError?.reason || txError?.message || 'Failed to execute bridge transaction';
      const isGasError = errorMsg.toLowerCase().includes('gas') || errorMsg.toLowerCase().includes('insufficient');
      
      return new Response(
        JSON.stringify({
          ok: false,
          message: isGasError ? 'Not enough ETH to pay gas fees' : errorMsg,
          error: 'TRANSACTION_FAILED',
        }),
        { status: isDev ? 200 : (isGasError ? 400 : 500), headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[transfer-between-wallets] Transaction created:', gelatoResponse.taskId);

    // Record transaction in database
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
        tx_hash: gelatoResponse.taskId,
        metadata: {
          transfer_type: 'internal_to_hyperliquid',
          destination_address: destinationAddress,
          bridge_method: 'squid_router',
          squid_route_id: route.route?.requestId || '',
          transaction_hash: gelatoResponse.taskId,
          estimated_time_seconds: route.route?.estimate?.estimatedRouteDuration || 20,
          source_chain: 'ethereum',
          dest_chain: 'arbitrum',
          axelar_tracking_url: `https://axelarscan.io/gmp/${gelatoResponse.taskId}`,
        }
      });

    if (txError) {
      console.error('[transfer-between-wallets] Transaction record failed:', txError);
    }

    // Update balance snapshot
    await supabase
      .from('balance_snapshots')
      .insert({
        user_id: user.id,
        asset: 'USDC',
        amount: -amount,
        snapshot_at: new Date().toISOString()
      });

    console.log('[transfer-between-wallets] Transfer initiated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        transactionHash: gelatoResponse.taskId,
        squidRouteId: route.route?.requestId || '',
        estimatedTime: Math.ceil(route.route?.estimate?.estimatedRouteDuration || 20),
        axelarTrackingUrl: `https://axelarscan.io/gmp/${gelatoResponse.taskId}`,
        message: 'Transfer initiated via Squid Router',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[transfer-between-wallets] Error:', error);
    const errorMsg = error?.reason || error?.message || 'Internal server error';
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        message: errorMsg,
        error: 'INTERNAL_ERROR'
      }),
      { status: isDev ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Decrypt private key using PBKDF2 + AES-GCM
async function decryptPrivateKey(
  encryptedBase64: string,
  ivBase64: string,
  saltBase64: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder();
  
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
      salt: base64ToUint8Array(saltBase64),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const encrypted = base64ToUint8Array(encryptedBase64);
  const iv = base64ToUint8Array(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(
    atob(base64).split('').map(c => c.charCodeAt(0))
  );
}
