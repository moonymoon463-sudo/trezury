import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Connection, Keypair } from "npm:@solana/web3.js@1.95.8";
import bs58 from "npm:bs58@6.0.0";

const isDev = Deno.env.get("ENV") !== "production";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Solana RPC endpoints
const RPC_ENDPOINTS = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};

/**
 * Get Solana wallet from encrypted storage
 */
async function getWalletKeypair(supabase: any, userId: string, password: string): Promise<Keypair> {
  try {
    // Get encrypted wallet data via RPC
    const { data: walletData, error } = await supabase.rpc('get_solana_wallet', {
      p_user_id: userId,
    });

    if (error || !walletData) {
      throw new Error('WALLET_NOT_FOUND');
    }

    // Decrypt the private key using password
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const salt = bs58.decode(walletData.encryption_salt);
    const iv = bs58.decode(walletData.encryption_iv);

    const decryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt).buffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const encryptedData = bs58.decode(walletData.encrypted_private_key);

    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
      decryptionKey,
      new Uint8Array(encryptedData).buffer
    );

    const secretKey = new Uint8Array(decryptedData);
    return Keypair.fromSecretKey(secretKey);
  } catch (err) {
    console.error('[01-trade] Wallet decryption failed:', err.message);
    throw new Error('WALLET_DECRYPTION_FAILED');
  }
}

/**
 * Check SOL balance for transaction fees
 */
async function checkSolBalance(connection: Connection, publicKey: any): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / 1e9; // Convert lamports to SOL
}

/**
 * Place order on 01 Protocol
 */
async function placeOrder(
  connection: Connection,
  keypair: Keypair,
  params: {
    market: string;
    side: 'long' | 'short';
    size: number;
    price?: number;
    orderType: 'market' | 'limit';
    leverage?: number;
  }
) {
  // TODO: Implement actual zo-sdk integration when API is available
  // For now, return mock response structure
  
  console.log('[01-trade] Placing order:', {
    wallet: keypair.publicKey.toBase58(),
    market: params.market,
    side: params.side,
    size: params.size,
    orderType: params.orderType,
  });

  // Check SOL balance
  const solBalance = await checkSolBalance(connection, keypair.publicKey);
  if (solBalance < 0.01) {
    throw new Error('INSUFFICIENT_SOL');
  }

  // Simulate order placement
  return {
    orderId: `01_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    market: params.market,
    side: params.side,
    size: params.size,
    price: params.price || 0,
    status: 'submitted',
    timestamp: Date.now(),
  };
}

/**
 * Close position on 01 Protocol
 */
async function closePosition(
  connection: Connection,
  keypair: Keypair,
  params: {
    market: string;
    size?: number;
  }
) {
  console.log('[01-trade] Closing position:', {
    wallet: keypair.publicKey.toBase58(),
    market: params.market,
  });

  // Check SOL balance
  const solBalance = await checkSolBalance(connection, keypair.publicKey);
  if (solBalance < 0.01) {
    throw new Error('INSUFFICIENT_SOL');
  }

  // Simulate position close
  return {
    market: params.market,
    closedSize: params.size || 0,
    status: 'closed',
    timestamp: Date.now(),
  };
}

/**
 * Cancel order on 01 Protocol
 */
async function cancelOrder(
  connection: Connection,
  keypair: Keypair,
  params: {
    orderId: string;
    market: string;
  }
) {
  console.log('[01-trade] Canceling order:', {
    wallet: keypair.publicKey.toBase58(),
    orderId: params.orderId,
  });

  return {
    orderId: params.orderId,
    status: 'cancelled',
    timestamp: Date.now(),
  };
}

/**
 * Get positions from 01 Protocol
 */
async function getPositions(
  connection: Connection,
  publicKey: any
) {
  console.log('[01-trade] Getting positions for:', publicKey.toBase58());

  // Simulate positions fetch
  return {
    positions: [],
    totalValue: 0,
    unrealizedPnl: 0,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('UNAUTHORIZED');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('UNAUTHORIZED');
    }

    console.log('[01-trade] Request from user:', user.id);

    // Parse request body
    const body = await req.json();
    const { operation, params, password, cluster = 'mainnet' } = body;

    if (!operation || !password) {
      throw new Error('MISSING_PARAMETERS');
    }

    // Get wallet keypair
    const keypair = await getWalletKeypair(supabase, user.id, password);
    const connection = new Connection(RPC_ENDPOINTS[cluster as keyof typeof RPC_ENDPOINTS]);

    console.log('[01-trade] Operation:', operation, 'Wallet:', keypair.publicKey.toBase58());

    // Route operations
    let result;
    switch (operation) {
      case 'place_order':
        result = await placeOrder(connection, keypair, params);
        break;
      case 'close_position':
        result = await closePosition(connection, keypair, params);
        break;
      case 'cancel_order':
        result = await cancelOrder(connection, keypair, params);
        break;
      case 'get_positions':
        result = await getPositions(connection, keypair.publicKey);
        break;
      default:
        throw new Error('INVALID_OPERATION');
    }

    // Log successful trade
    await supabase.from('trade_logs' as any).insert({
      user_id: user.id,
      operation,
      market: params?.market || null,
      side: params?.side || null,
      size: params?.size || null,
      status: 'success',
      result: result,
    });

    const response = {
      ok: true,
      message: `${operation} completed successfully`,
      data: result,
    };

    if (isDev) {
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[01-trade] Error:', err.message);

    const errorMap: Record<string, { message: string; code: number }> = {
      UNAUTHORIZED: { message: 'Authentication required', code: 401 },
      WALLET_NOT_FOUND: { message: 'Solana wallet not found', code: 404 },
      WALLET_DECRYPTION_FAILED: { message: 'Invalid password', code: 403 },
      INSUFFICIENT_SOL: { message: 'Not enough SOL for transaction fees', code: 400 },
      MISSING_PARAMETERS: { message: 'Missing required parameters', code: 400 },
      INVALID_OPERATION: { message: 'Invalid operation', code: 400 },
    };

    const error = errorMap[err.message] || { message: 'Transaction failed', code: 500 };

    const response = {
      ok: false,
      message: error.message,
      error: err.message,
    };

    if (isDev) {
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(response), {
      status: error.code,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
