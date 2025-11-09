import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ethers } from 'https://esm.sh/ethers@6.15.0';
import * as CryptoJS from 'https://esm.sh/crypto-js@4.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ETHEREUM_RPC = 'https://eth.llamarpc.com';
const ARBITRUM_RPC = 'https://arb1.arbitrum.io/rpc';
const WORMHOLE_BRIDGE_ETHEREUM = '0x3ee18B2214AFF97000D974cf647E7C347E8fa585';
const WORMHOLE_BRIDGE_ARBITRUM = '0x0b2402144Bb366A632D14B83F244D2e0e21bD39c';

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

async function parseSequenceFromReceipt(receipt: any): Promise<string | null> {
  // LogMessagePublished event signature
  const logMessageTopic = '0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2';
  
  for (const log of receipt.logs) {
    if (log.topics[0] === logMessageTopic && 
        log.address.toLowerCase() === WORMHOLE_BRIDGE_ETHEREUM.toLowerCase()) {
      try {
        // Decode sequence from log data
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['uint64', 'uint32', 'bytes', 'uint8'],
          log.data
        );
        return decoded[0].toString();
      } catch (e) {
        console.error('Error decoding sequence:', e);
      }
    }
  }
  return null;
}

async function fetchVAA(chainId: number, emitterAddress: string, sequence: string): Promise<string | null> {
  const emitter = emitterAddress.replace('0x', '').padStart(64, '0');
  const url = `https://wormhole-v2-mainnet-api.certus.one/v1/signed_vaa/${chainId}/${emitter}/${sequence}`;
  
  console.log(`🔍 Fetching VAA: ${url}`);
  
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ VAA fetched on attempt ${i + 1}`);
        return data.vaaBytes;
      }
      console.log(`⏳ Attempt ${i + 1}/10: VAA not ready (${response.status})`);
    } catch (error) {
      console.log(`❌ Attempt ${i + 1}/10 failed:`, error.message);
    }
    
    // Wait 2 seconds between attempts
    await new Deno.Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return null;
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

    const { userId, password, ethTxHashes } = await req.json();

    if (!userId || !password || !ethTxHashes || !Array.isArray(ethTxHashes)) {
      return new Response(
        JSON.stringify({ error: 'userId, password, and ethTxHashes array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔓 Starting manual Wormhole redemption for user ${userId}`);
    console.log(`📝 Processing ${ethTxHashes.length} Ethereum transactions`);

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
    const arbProvider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(privateKey, arbProvider);
    
    // Check ETH balance for gas
    const balance = await arbProvider.getBalance(wallet.address);
    console.log(`💰 ETH balance: ${ethers.formatEther(balance)}`);
    
    if (balance < ethers.parseEther('0.001')) {
      throw new Error('Insufficient ETH for gas on Arbitrum');
    }

    const ethProvider = new ethers.JsonRpcProvider(ETHEREUM_RPC);
    const emitterAddress = '0x' + '0'.repeat(24) + WORMHOLE_BRIDGE_ETHEREUM.slice(2).toLowerCase();
    const results = [];

    // Process each Ethereum transaction
    for (const ethTxHash of ethTxHashes) {
      console.log(`\n🔄 Processing ${ethTxHash}...`);
      
      try {
        // Get Ethereum transaction receipt
        const receipt = await ethProvider.getTransactionReceipt(ethTxHash);
        if (!receipt) {
          throw new Error('Transaction not found on Ethereum');
        }

        // Parse sequence from logs
        const sequence = await parseSequenceFromReceipt(receipt);
        if (!sequence) {
          throw new Error('Could not parse Wormhole sequence from logs');
        }

        console.log(`✅ Sequence: ${sequence}`);

        // Fetch VAA
        const vaaBytes = await fetchVAA(2, emitterAddress, sequence);
        if (!vaaBytes) {
          throw new Error('Failed to fetch VAA from Wormhole Guardians');
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
          console.log(`✅ Already redeemed`);
          results.push({
            ethTxHash,
            sequence,
            alreadyRedeemed: true,
            success: true
          });
          continue;
        }

        console.log(`📡 Submitting redemption transaction...`);

        // Submit redemption
        const tx = await bridgeContract.completeTransfer('0x' + vaaBytes);
        console.log(`✅ Transaction submitted: ${tx.hash}`);

        // Wait for confirmation
        const arbReceipt = await tx.wait();
        console.log(`✅ Redeemed in block ${arbReceipt.blockNumber}`);

        results.push({
          ethTxHash,
          sequence,
          arbTxHash: tx.hash,
          blockNumber: arbReceipt.blockNumber,
          success: true
        });

      } catch (error) {
        console.error(`❌ Error processing ${ethTxHash}:`, error);
        results.push({
          ethTxHash,
          error: error.message,
          success: false
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: ethTxHashes.length,
          successful: successCount,
          failed: ethTxHashes.length - successCount
        }
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
