import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ethers } from 'https://esm.sh/ethers@6.15.0';
import * as CryptoJS from 'https://esm.sh/crypto-js@4.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ARBITRUM_RPC = 'https://arb1.arbitrum.io/rpc';
const WORMHOLE_BRIDGE_ARBITRUM = '0x0b2402144Bb366A632D14B83F244D2e0e21bD39c';

// Minimal ABI for Wormhole Token Bridge
const WORMHOLE_ABI = [
  'function completeTransfer(bytes encodedVm) external',
  'function isTransferCompleted(bytes32) view returns (bool)'
];

async function decryptPrivateKey(encryptedKey: string, password: string): Promise<string> {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedKey, password);
    const privateKey = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!privateKey || privateKey.length === 0) {
      throw new Error('Decryption failed - invalid password');
    }
    
    return privateKey;
  } catch (error) {
    throw new Error(`Decryption error: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, vaaBytes, bridgeId, password } = await req.json();

    if (!userId || !vaaBytes || !password) {
      return new Response(
        JSON.stringify({ error: 'userId, vaaBytes, and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔓 Redeeming Wormhole VAA for user ${userId}`);
    console.log(`📝 Bridge ID: ${bridgeId}`);

    // Get user's wallet
    const { data: walletData, error: walletError } = await supabaseClient
      .from('secure_wallets')
      .select('address, encrypted_private_key')
      .eq('user_id', userId)
      .single();

    if (walletError || !walletData) {
      throw new Error('Wallet not found');
    }

    console.log(`👛 Wallet address: ${walletData.address}`);

    // Decrypt private key
    const privateKey = await decryptPrivateKey(walletData.encrypted_private_key, password);
    console.log(`✅ Private key decrypted`);

    // Connect to Arbitrum
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 ETH balance: ${ethers.formatEther(balance)}`);
    
    if (balance < ethers.parseEther('0.001')) {
      throw new Error('Insufficient ETH for gas on Arbitrum');
    }

    // Check if already redeemed
    const bridgeContract = new ethers.Contract(
      WORMHOLE_BRIDGE_ARBITRUM,
      WORMHOLE_ABI,
      wallet
    );

    const vaaHash = ethers.keccak256('0x' + vaaBytes);
    const isCompleted = await bridgeContract.isTransferCompleted(vaaHash);

    if (isCompleted) {
      console.log(`✅ VAA already redeemed`);
      
      // Update DB if bridgeId provided
      if (bridgeId) {
        await supabaseClient
          .from('bridge_transactions')
          .update({ 
            status: 'step1_complete',
            metadata: { already_redeemed: true }
          })
          .eq('id', bridgeId);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          alreadyRedeemed: true,
          message: 'VAA was already redeemed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📡 Submitting redemption transaction...`);

    // Submit redemption
    const tx = await bridgeContract.completeTransfer('0x' + vaaBytes);
    console.log(`✅ Transaction submitted: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Update bridge_transactions if bridgeId provided
    if (bridgeId) {
      await supabaseClient
        .from('bridge_transactions')
        .update({ 
          destination_tx_hash: tx.hash,
          status: 'step1_complete',
          metadata: { 
            redemption_block: receipt.blockNumber,
            redemption_timestamp: Date.now()
          }
        })
        .eq('id', bridgeId);
      
      console.log(`✅ Updated bridge record ${bridgeId}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Redemption error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
