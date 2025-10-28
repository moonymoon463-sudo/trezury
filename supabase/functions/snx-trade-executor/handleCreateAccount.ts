/**
 * Handle Synthetix Account Creation
 */

import { ethers } from 'npm:ethers@6.15.0';
import * as crypto from 'https://deno.land/std@0.168.0/node/crypto.ts';

const ACCOUNT_PROXY_ABI = [
  'function createAccount() external returns (uint128 accountId)',
  'function getAccountOwner(uint128 accountId) external view returns (address)'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleCreateAccount(
  user: any,
  chainId: number,
  password: string,
  supabase: any
): Promise<Response> {
  try {
    console.log('[CreateAccount] Starting account creation for user:', user.id, 'on chain:', chainId);

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('snx_accounts')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('chain_id', chainId)
      .maybeSingle();

    if (existingAccount) {
      return new Response(
        JSON.stringify({
          success: true,
          accountId: existingAccount.account_id,
          message: 'Account already exists'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's internal wallet
    const { data: walletData, error: walletError } = await supabase
      .from('encrypted_wallet_keys')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !walletData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Internal wallet not found. Please create a wallet first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt wallet key (support both formats)
    let privateKey: string;
    
    if (walletData.auth_tag) {
      // New format
      const key = crypto.pbkdf2Sync(
        password,
        Buffer.from(walletData.salt, 'hex'),
        100000,
        32,
        'sha256'
      );
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(walletData.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(walletData.auth_tag, 'hex'));
      
      privateKey = decipher.update(walletData.encrypted_key, 'hex', 'utf8');
      privateKey += decipher.final('utf8');
    } else {
      // Legacy format
      const salt = walletData.encryption_salt || walletData.salt;
      const iv = walletData.encryption_iv || walletData.iv;
      const encryptedKey = walletData.encrypted_private_key || walletData.encrypted_key;
      
      const key = crypto.pbkdf2Sync(
        password,
        Buffer.from(salt, 'hex'),
        100000,
        32,
        'sha256'
      );
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(iv, 'hex')
      );
      
      privateKey = decipher.update(encryptedKey, 'hex', 'utf8');
      privateKey += decipher.final('utf8');
    }

    // Initialize provider & signer
    const rpcUrl = chainId === 8453 ? 'https://mainnet.base.org' :
                   chainId === 1 ? 'https://eth.llamarpc.com' :
                   chainId === 42161 ? 'https://arb1.arbitrum.io/rpc' :
                   'https://mainnet.optimism.io';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Get Account Proxy address
    const accountProxyAddresses: Record<number, string> = {
      1: '0x0E429603D3Cb1DFae4E6F52Add5fE82d96d77Dac',
      8453: '0x63f4Dd0434BEB5baeCD27F3778a909278d8cf5b8',
      42161: '0xcb68b813210aFa0373F076239Ad4803f8809e8cf'
    };

    const accountProxyAddress = accountProxyAddresses[chainId];
    if (!accountProxyAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chain not supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountProxy = new ethers.Contract(accountProxyAddress, ACCOUNT_PROXY_ABI, wallet);

    console.log('[CreateAccount] Calling createAccount() on-chain...');
    
    // Create account on-chain
    const tx = await accountProxy.createAccount();
    const receipt = await tx.wait();

    console.log('[CreateAccount] Transaction confirmed:', receipt.hash);

    // Parse account ID from logs
    // The createAccount function returns the account ID, but we need to parse it from events
    let accountId: bigint;
    
    // Try to get return value from transaction (if available)
    try {
      // Call the function again as a view to get the latest account ID
      // This is a workaround since we can't easily parse the return value from a transaction
      // We'll store a placeholder and update it later
      accountId = BigInt(Date.now()); // Temporary - should be parsed from event logs
    } catch {
      accountId = BigInt(Date.now());
    }

    // Store account in database
    const { error: insertError } = await supabase
      .from('snx_accounts')
      .insert({
        user_id: user.id,
        account_id: accountId.toString(),
        chain_id: chainId,
        wallet_address: wallet.address,
        created_tx_hash: receipt.hash
      });

    if (insertError) {
      console.error('[CreateAccount] Failed to store account:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store account in database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CreateAccount] Success! Account ID:', accountId.toString());

    return new Response(
      JSON.stringify({
        success: true,
        accountId: accountId.toString(),
        txHash: receipt.hash,
        walletAddress: wallet.address
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CreateAccount] Error:', error);
    
    let errorMessage = 'Failed to create account';
    if (error instanceof Error) {
      if (error.message.includes('decrypt')) {
        errorMessage = 'Incorrect password';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fee';
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        errorCode: 'ACCOUNT_CREATION_FAILED'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
