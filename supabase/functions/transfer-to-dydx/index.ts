// Transfer USDC from Ethereum to dYdX using Squid Router v2
// Deployment: 2025-10-28T05:55:00Z - Fixed Squid API endpoint to v2
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

// Squid Router API endpoint - using v2 for production reliability
const SQUID_API_URL = 'https://v2.api.squidrouter.com/v2/route';
const SQUID_INTEGRATOR_ID = 'squid-swap-widget'; // Using demo ID for testing - register 'trezury-app' for production

// USDC on Ethereum Mainnet
const ETHEREUM_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
// USDC on dYdX Chain (IBC denom)
const DYDX_USDC = 'ibc/8E27BA2D5493AF5636760E354E46004562C46AB7EC0CC4C1CA14E9E20E2545B5';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // Handle ping operation
    const url = new URL(req.url);
    if (url.searchParams.get('operation') === 'ping') {
      return new Response(
        JSON.stringify({ ok: true, timestamp: Date.now(), service: 'transfer-to-dydx' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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
        JSON.stringify({ ok: false, message: 'Authentication required', error: 'Unauthorized' }),
        { status: isDev ? 200 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { amount, password, destinationAddress } = await req.json();

    console.log('[transfer-to-dydx] Gasless deposit request via Squid + Gelato', {
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

    if (!destinationAddress || !destinationAddress.startsWith('dydx1')) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Invalid dYdX address', error: 'INVALID_ADDRESS' }),
        { status: isDev ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get encrypted wallet data
    const { data: walletData, error: walletError } = await supabase
      .from('encrypted_wallet_keys')
      .select('encrypted_private_key, encryption_iv, encryption_salt')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletError || !walletData) {
      console.error('[transfer-to-dydx] Wallet not found:', walletError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Internal wallet not found', error: 'NO_WALLET' }),
        { status: isDev ? 200 : 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Decrypt wallet with debug logging and fallback
    console.log('[transfer-to-dydx] Attempting wallet decryption:', {
      userId: user.id,
      hasEncryptedKey: !!walletData.encrypted_private_key,
      encryptedKeyLength: walletData.encrypted_private_key?.length,
      ivLength: walletData.encryption_iv?.length,
      saltLength: walletData.encryption_salt?.length,
      passwordLength: password?.length,
      passwordFirstChar: password ? password.charCodeAt(0) : null,
    });

    let decryptedKey: string;
    
    try {
      // Try password-based decryption first
      console.log('[transfer-to-dydx] Trying password-based decryption...');
      decryptedKey = await decryptPrivateKey(
        walletData.encrypted_private_key,
        walletData.encryption_iv,
        walletData.encryption_salt,
        password
      );
      console.log('[transfer-to-dydx] ✅ Password-based decryption succeeded');
    } catch (error) {
      console.warn('[transfer-to-dydx] Password decryption failed:', error.message);
      console.log('[transfer-to-dydx] Attempting legacy userId-based decryption...');
      
      try {
        // Fallback: Try userId as password (legacy wallets)
        decryptedKey = await decryptPrivateKey(
          walletData.encrypted_private_key,
          walletData.encryption_iv,
          walletData.encryption_salt,
          user.id
        );
        console.log('[transfer-to-dydx] ✅ Legacy userId decryption succeeded');
      } catch (legacyError) {
        console.error('[transfer-to-dydx] Both decryption methods failed:', {
          passwordError: error.message,
          legacyError: legacyError.message
        });
        
        // Return structured error
        return new Response(
          JSON.stringify({ 
            ok: false,
            message: 'Invalid wallet password. This is the password you used when creating or importing your internal wallet.',
            error: 'WALLET_DECRYPTION_FAILED',
            hint: 'Try the password you set when you created your wallet, not your trading password.'
          }),
          { status: isDev ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 3: Import ethers
    const { ethers } = await import('https://esm.sh/ethers@6.13.0');
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    const wallet = new ethers.Wallet(decryptedKey, provider);

    console.log('[transfer-to-dydx] Wallet loaded:', wallet.address);

    // Step 4: Get Squid route
    console.log('[transfer-to-dydx] Fetching route from Squid Router API');
    const amountInBaseUnits = Math.floor(amount * 1_000_000).toString(); // USDC has 6 decimals

    let routeResponse;
    try {
      routeResponse = await fetch(SQUID_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-integrator-id': SQUID_INTEGRATOR_ID,
        },
        body: JSON.stringify({
          integratorId: SQUID_INTEGRATOR_ID, // Required: Integrator ID in body
          fromChain: "1",  // Ethereum mainnet (string required by v2 API)
          fromToken: ETHEREUM_USDC,
          fromAmount: amountInBaseUnits,
          fromAddress: wallet.address,
          toChain: "dydx-mainnet-1",
          toToken: DYDX_USDC,
          toAddress: destinationAddress,
          slippage: 1.0,
          enableForecall: true,
          quoteOnly: false
        }),
      });
    } catch (fetchError: any) {
      // Handle DNS resolution failures
      if (fetchError.message?.includes('dns error') || 
          fetchError.message?.includes('failed to lookup') ||
          fetchError.message?.includes('getaddrinfo')) {
        console.error('[transfer-to-dydx] DNS resolution failed - Squid API unreachable:', fetchError);
        return new Response(
          JSON.stringify({
            ok: false,
            message: 'Unable to reach bridging service. Please try again in a few moments.',
            error: 'SQUID_API_UNREACHABLE',
            hint: 'Network connectivity issue - not a wallet or password problem.'
          }),
          { status: isDev ? 200 : 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError; // Re-throw other errors
    }

    if (!routeResponse.ok) {
      const errorData = await routeResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('[transfer-to-dydx] Squid API error:', errorData);
      
      return new Response(
        JSON.stringify({ 
          ok: false,
          message: errorData.message || 'Failed to get bridge route',
          error: 'SQUID_ROUTE_ERROR',
          hint: errorData.type === 'UNAUTHORIZED' 
            ? 'Invalid Integrator ID - please contact support'
            : 'Please try again or contact support if the issue persists'
        }),
        { status: isDev ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = await routeResponse.json();
    console.log('[transfer-to-dydx] Squid route received');

    const txRequest = route.route?.transactionRequest;
    if (!txRequest) {
      console.error('[transfer-to-dydx] No transactionRequest in route');
      throw new Error('No executable transaction returned from Squid API');
    }

    // Step 5: Execute transaction directly (bypass Gelato for now due to SDK issues)
    console.log('[transfer-to-dydx] Executing transaction via wallet');
    
    let gelatoResponse;
    try {
      // Send transaction directly from user's wallet
      const tx = await wallet.sendTransaction({
        to: txRequest.target || txRequest.targetAddress,
        data: txRequest.data,
        value: txRequest.value || '0',
        gasLimit: txRequest.gasLimit || 500000,
      });
      
      console.log('[transfer-to-dydx] Transaction sent:', tx.hash);
      await tx.wait();
      console.log('[transfer-to-dydx] Transaction confirmed:', tx.hash);
      
      gelatoResponse = { taskId: tx.hash };
    } catch (txError: any) {
      console.error('[transfer-to-dydx] Transaction execution failed:', txError);
      const errorMsg = txError?.reason || txError?.message || 'Failed to execute bridge transaction';
      const isGasError = errorMsg.toLowerCase().includes('gas') || errorMsg.toLowerCase().includes('insufficient');
      
      return new Response(
        JSON.stringify({
          ok: false,
          message: isGasError ? 'Not enough ETH to pay gas fees' : errorMsg,
          error: 'TRANSACTION_FAILED',
          hint: 'Please ensure your wallet has enough ETH for gas fees'
        }),
        { status: isDev ? 200 : (isGasError ? 400 : 500), headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[transfer-to-dydx] Transaction created:', gelatoResponse.taskId);

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
        tx_hash: gelatoResponse.taskId,
        metadata: {
          transfer_type: 'internal_to_dydx',
          destination_address: destinationAddress,
          bridge_method: 'squid_router',
          squid_route_id: route.route?.requestId || '',
          transaction_hash: gelatoResponse.taskId,
          estimated_time_seconds: route.route?.estimate?.estimatedRouteDuration || 20,
          gas_mode: 'user_paid',
          source_chain: 'ethereum',
          dest_chain: 'dydx',
          axelar_tracking_url: `https://axelarscan.io/gmp/${gelatoResponse.taskId}`,
        }
      });

    if (txError) {
      console.error('[transfer-to-dydx] Transaction record failed:', txError);
    }

    // Step 7: Update balance snapshot
    await supabase
      .from('balance_snapshots')
      .insert({
        user_id: user.id,
        asset: 'USDC',
        amount: -amount,
        snapshot_at: new Date().toISOString()
      });

    console.log('[transfer-to-dydx] Deposit initiated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        transactionHash: gelatoResponse.taskId,
        squidRouteId: route.route?.requestId || '',
        estimatedTime: Math.ceil(route.route?.estimate?.estimatedRouteDuration || 20),
        axelarTrackingUrl: `https://axelarscan.io/gmp/${gelatoResponse.taskId}`,
        message: 'Deposit initiated via Squid Router',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[transfer-to-dydx] Error:', error);
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
