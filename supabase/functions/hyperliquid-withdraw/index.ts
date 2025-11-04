// Withdraw USDC from Hyperliquid L1 to any supported chain via Squid Router
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

const SQUID_API_URL = 'https://v2.api.squidrouter.com/v2/route';
const SQUID_INTEGRATOR_ID = 'squid-swap-widget';

// USDC on Hyperliquid L1 (Arbitrum)
const HYPERLIQUID_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get('operation') === 'ping') {
      return new Response(
        JSON.stringify({ ok: true, timestamp: Date.now(), service: 'hyperliquid-withdraw' }),
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
      console.error('[hyperliquid-withdraw] Auth error:', authError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Authentication required', error: 'Unauthorized' }),
        { status: isDev ? 200 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, password, destinationChain, destinationAddress, destinationToken } = await req.json();

    console.log('[hyperliquid-withdraw] Withdraw request', {
      userId: user.id,
      amount,
      destinationChain,
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

    if (!destinationAddress || !destinationChain || !destinationToken) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Missing destination details', error: 'INVALID_DESTINATION' }),
        { status: isDev ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Hyperliquid wallet
    const { data: hlWallet, error: hlError } = await supabase
      .from('hyperliquid_wallets')
      .select('encrypted_private_key, encryption_iv, encryption_salt, address')
      .eq('user_id', user.id)
      .single();

    if (hlError || !hlWallet) {
      console.error('[hyperliquid-withdraw] Hyperliquid wallet not found:', hlError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Trading wallet not found', error: 'NO_WALLET' }),
        { status: isDev ? 200 : 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt wallet
    console.log('[hyperliquid-withdraw] Decrypting Hyperliquid wallet');
    let decryptedKey: string;
    
    try {
      decryptedKey = await decryptPrivateKey(
        hlWallet.encrypted_private_key,
        hlWallet.encryption_iv,
        hlWallet.encryption_salt,
        password
      );
      console.log('[hyperliquid-withdraw] ✅ Password-based decryption succeeded');
    } catch (error) {
      console.error('[hyperliquid-withdraw] Wallet decryption failed:', error.message);
      
      return new Response(
        JSON.stringify({ 
          ok: false,
          message: 'Invalid trading wallet password',
          error: 'WALLET_DECRYPTION_FAILED',
        }),
        { status: isDev ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import ethers with Arbitrum RPC (Hyperliquid L1)
    const { ethers } = await import('https://esm.sh/ethers@6.13.0');
    const provider = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc');
    const wallet = new ethers.Wallet(decryptedKey, provider);

    console.log('[hyperliquid-withdraw] Wallet loaded:', wallet.address);

    // Get Squid route (Hyperliquid/Arbitrum → Destination Chain)
    console.log('[hyperliquid-withdraw] Fetching route from Squid Router API');
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
          fromChain: "42161", // Arbitrum (Hyperliquid L1)
          fromToken: HYPERLIQUID_USDC,
          fromAmount: amountInBaseUnits,
          fromAddress: wallet.address,
          toChain: destinationChain,
          toToken: destinationToken,
          toAddress: destinationAddress,
          slippage: 1.0,
          enableForecall: true,
          quoteOnly: false
        }),
      });
    } catch (fetchError: any) {
      if (fetchError.message?.includes('dns error')) {
        console.error('[hyperliquid-withdraw] DNS resolution failed');
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
      console.error('[hyperliquid-withdraw] Squid API error:', errorData);
      
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
    console.log('[hyperliquid-withdraw] Squid route received');

    const txRequest = route.route?.transactionRequest;
    if (!txRequest) {
      console.error('[hyperliquid-withdraw] No transactionRequest in route');
      throw new Error('No executable transaction returned from Squid API');
    }

    // Execute transaction
    console.log('[hyperliquid-withdraw] Executing withdrawal transaction');
    
    let txResponse;
    try {
      const tx = await wallet.sendTransaction({
        to: txRequest.target || txRequest.targetAddress,
        data: txRequest.data,
        value: txRequest.value || '0',
        gasLimit: txRequest.gasLimit || 500000,
      });
      
      console.log('[hyperliquid-withdraw] Transaction sent:', tx.hash);
      await tx.wait();
      console.log('[hyperliquid-withdraw] Transaction confirmed:', tx.hash);
      
      txResponse = { taskId: tx.hash };
    } catch (txError: any) {
      console.error('[hyperliquid-withdraw] Transaction execution failed:', txError);
      const errorMsg = txError?.reason || txError?.message || 'Failed to execute withdrawal';
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

    console.log('[hyperliquid-withdraw] Withdrawal transaction created:', txResponse.taskId);

    // Record transaction in database
    const transactionId = crypto.randomUUID();
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: user.id,
        type: 'withdrawal',
        asset: 'USDC',
        quantity: amount,
        status: 'processing',
        tx_hash: txResponse.taskId,
        metadata: {
          withdrawal_type: 'hyperliquid_to_external',
          destination_address: destinationAddress,
          destination_chain: destinationChain,
          bridge_method: 'squid_router',
          squid_route_id: route.route?.requestId || '',
          transaction_hash: txResponse.taskId,
          estimated_time_seconds: route.route?.estimate?.estimatedRouteDuration || 20,
          source_chain: 'arbitrum',
          axelar_tracking_url: `https://axelarscan.io/gmp/${txResponse.taskId}`,
        }
      });

    if (txError) {
      console.error('[hyperliquid-withdraw] Transaction record failed:', txError);
    }

    console.log('[hyperliquid-withdraw] Withdrawal initiated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        transactionHash: txResponse.taskId,
        squidRouteId: route.route?.requestId || '',
        estimatedTime: Math.ceil(route.route?.estimate?.estimatedRouteDuration || 20),
        axelarTrackingUrl: `https://axelarscan.io/gmp/${txResponse.taskId}`,
        message: 'Withdrawal initiated via Squid Router',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[hyperliquid-withdraw] Error:', error);
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
