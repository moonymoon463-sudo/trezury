import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ethers } from 'https://esm.sh/ethers@6.15.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RPC endpoints
const RPC_ENDPOINTS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  polygon: 'https://polygon-rpc.com'
};

// USDC addresses
const USDC_ADDRESSES: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
};

// Wormhole Token Bridge addresses
const WORMHOLE_BRIDGES: Record<string, string> = {
  ethereum: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
  base: '0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627',
  arbitrum: '0x0b2402144Bb366A632D14B83F244D2e0e21bD39c'
};

// Across SpokePool addresses
const ACROSS_SPOKE_POOLS: Record<string, string> = {
  ethereum: '0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5',
  base: '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64',
  arbitrum: '0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A'
};

interface TransactionAnalysis {
  txHash: string;
  sourceChain: string;
  provider: 'wormhole' | 'across' | 'unknown';
  amount: string;
  timestamp: number;
  status: 'needs_redemption' | 'filled' | 'pending' | 'error';
  arbitrumTxHash?: string;
  vaaBytes?: string;
  sequence?: string;
  error?: string;
}

async function analyzeTxHash(txHash: string): Promise<TransactionAnalysis> {
  console.log(`🔍 Analyzing tx: ${txHash}`);
  
  // Try each chain
  for (const [chainName, rpcUrl] of Object.entries(RPC_ENDPOINTS)) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (receipt) {
        console.log(`✅ Found on ${chainName}`);
        
        // Parse logs to determine provider and amount
        const usdcAddress = USDC_ADDRESSES[chainName];
        const wormholeBridge = WORMHOLE_BRIDGES[chainName];
        const acrossSpokePool = ACROSS_SPOKE_POOLS[chainName];
        
        let provider_type: 'wormhole' | 'across' | 'unknown' = 'unknown';
        let amount = '0';
        let sequence: string | undefined;
        
        // Check for USDC Transfer events
        const transferTopic = ethers.id('Transfer(address,address,uint256)');
        
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === usdcAddress?.toLowerCase() && log.topics[0] === transferTopic) {
            // Decode amount
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);
            amount = ethers.formatUnits(decoded[0], 6);
            
            // Check recipient to determine provider
            const recipient = ethers.getAddress('0x' + log.topics[2].slice(26));
            
            if (recipient.toLowerCase() === wormholeBridge?.toLowerCase()) {
              provider_type = 'wormhole';
              console.log(`  📡 Wormhole bridge detected, amount: ${amount} USDC`);
            } else if (recipient.toLowerCase() === acrossSpokePool?.toLowerCase()) {
              provider_type = 'across';
              console.log(`  🌉 Across bridge detected, amount: ${amount} USDC`);
            }
          }
          
          // Extract Wormhole sequence if Wormhole
          if (provider_type === 'wormhole' && log.address.toLowerCase() === wormholeBridge?.toLowerCase()) {
            // LogMessagePublished event
            const logMessageTopic = '0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2';
            if (log.topics[0] === logMessageTopic) {
              sequence = BigInt(log.topics[2]).toString();
              console.log(`  📝 Wormhole sequence: ${sequence}`);
            }
          }
        }
        
        const block = await provider.getBlock(receipt.blockNumber);
        
        return {
          txHash,
          sourceChain: chainName,
          provider: provider_type,
          amount,
          timestamp: block?.timestamp || 0,
          status: 'pending',
          sequence
        };
      }
    } catch (err) {
      // Chain doesn't have this tx, continue
      continue;
    }
  }
  
  return {
    txHash,
    sourceChain: 'unknown',
    provider: 'unknown',
    amount: '0',
    timestamp: 0,
    status: 'error',
    error: 'Transaction not found on any chain'
  };
}

async function checkWormholeRedemption(
  sequence: string,
  sourceChain: string,
  emitterAddress: string
): Promise<{ redeemed: boolean; vaaBytes?: string }> {
  try {
    // Fetch VAA from Guardians
    const chainIds: Record<string, number> = {
      ethereum: 2,
      base: 30,
    };
    
    const chainId = chainIds[sourceChain];
    if (!chainId) {
      return { redeemed: false };
    }
    
    // Try to fetch VAA
    const guardianUrl = `https://wormhole-v2-mainnet-api.certus.one/v1/signed_vaa/${chainId}/${emitterAddress}/${sequence}`;
    const vaaResponse = await fetch(guardianUrl);
    
    if (!vaaResponse.ok) {
      console.log(`  ⏳ VAA not ready yet for sequence ${sequence}`);
      return { redeemed: false };
    }
    
    const vaaData = await vaaResponse.json();
    const vaaBytes = vaaData.vaaBytes;
    
    console.log(`  ✅ VAA fetched for sequence ${sequence}`);
    
    // Check if redeemed on Arbitrum
    const arbitrumProvider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.arbitrum);
    const bridgeAbi = ['function isTransferCompleted(bytes32) view returns (bool)'];
    const bridgeContract = new ethers.Contract(
      WORMHOLE_BRIDGES.arbitrum,
      bridgeAbi,
      arbitrumProvider
    );
    
    // Calculate VAA hash
    const vaaHash = ethers.keccak256('0x' + vaaBytes);
    const isCompleted = await bridgeContract.isTransferCompleted(vaaHash);
    
    console.log(`  ${isCompleted ? '✅ Redeemed' : '❌ NOT redeemed'} on Arbitrum`);
    
    return { redeemed: isCompleted, vaaBytes };
  } catch (err) {
    console.error(`  ❌ Error checking redemption:`, err);
    return { redeemed: false };
  }
}

async function checkAcrossFill(txHash: string, amount: string, recipient: string): Promise<string | null> {
  try {
    // Check Arbitrum for USDC transfer to recipient
    const arbitrumProvider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.arbitrum);
    const usdcAddress = USDC_ADDRESSES.arbitrum;
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    
    // Search recent blocks for matching transfer
    const currentBlock = await arbitrumProvider.getBlockNumber();
    const fromBlock = currentBlock - 10000; // ~24 hours
    
    const filter = {
      address: usdcAddress,
      topics: [
        transferTopic,
        null, // from (any)
        ethers.zeroPadValue(recipient, 32) // to recipient
      ],
      fromBlock,
      toBlock: 'latest'
    };
    
    const logs = await arbitrumProvider.getLogs(filter);
    
    for (const log of logs) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);
      const transferAmount = ethers.formatUnits(decoded[0], 6);
      
      // Match amount (allow 1% tolerance for fees)
      const amountNum = parseFloat(amount);
      const transferNum = parseFloat(transferAmount);
      const diff = Math.abs(amountNum - transferNum) / amountNum;
      
      if (diff < 0.01) {
        console.log(`  ✅ Across fill found: ${log.transactionHash}`);
        return log.transactionHash;
      }
    }
    
    console.log(`  ⏳ Across fill not found yet`);
    return null;
  } catch (err) {
    console.error(`  ❌ Error checking Across fill:`, err);
    return null;
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

    const { txHashes, userId, recipientAddress } = await req.json();

    if (!txHashes || !Array.isArray(txHashes) || !userId) {
      return new Response(
        JSON.stringify({ error: 'txHashes array and userId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔎 Starting forensic analysis for ${txHashes.length} transactions`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📬 Recipient: ${recipientAddress}`);

    const analyses: TransactionAnalysis[] = [];

    for (const txHash of txHashes) {
      const analysis = await analyzeTxHash(txHash);
      
      // For Wormhole, check redemption status
      if (analysis.provider === 'wormhole' && analysis.sequence) {
        const emitterAddress = analysis.sourceChain === 'ethereum' 
          ? '0x' + '0'.repeat(24) + WORMHOLE_BRIDGES.ethereum.slice(2)
          : '0x' + '0'.repeat(24) + WORMHOLE_BRIDGES.base.slice(2);
        
        const redemptionCheck = await checkWormholeRedemption(
          analysis.sequence,
          analysis.sourceChain,
          emitterAddress
        );
        
        analysis.status = redemptionCheck.redeemed ? 'filled' : 'needs_redemption';
        analysis.vaaBytes = redemptionCheck.vaaBytes;
      }
      
      // For Across, check fill status
      if (analysis.provider === 'across' && recipientAddress) {
        const fillTxHash = await checkAcrossFill(txHash, analysis.amount, recipientAddress);
        if (fillTxHash) {
          analysis.status = 'filled';
          analysis.arbitrumTxHash = fillTxHash;
        }
      }
      
      analyses.push(analysis);
    }

    // Check Arbitrum balance
    const arbitrumProvider = new ethers.JsonRpcProvider(RPC_ENDPOINTS.arbitrum);
    const usdcContract = new ethers.Contract(
      USDC_ADDRESSES.arbitrum,
      ['function balanceOf(address) view returns (uint256)'],
      arbitrumProvider
    );
    
    let arbitrumBalance = '0';
    if (recipientAddress) {
      const balance = await usdcContract.balanceOf(recipientAddress);
      arbitrumBalance = ethers.formatUnits(balance, 6);
      console.log(`💰 Arbitrum USDC balance: ${arbitrumBalance}`);
    }

    // Summary
    const summary = {
      total: analyses.length,
      wormhole: analyses.filter(a => a.provider === 'wormhole').length,
      across: analyses.filter(a => a.provider === 'across').length,
      needsRedemption: analyses.filter(a => a.status === 'needs_redemption').length,
      filled: analyses.filter(a => a.status === 'filled').length,
      pending: analyses.filter(a => a.status === 'pending').length,
      totalAmount: analyses.reduce((sum, a) => sum + parseFloat(a.amount), 0).toFixed(2),
      arbitrumBalance
    };

    console.log(`📊 Summary:`, summary);

    return new Response(
      JSON.stringify({ analyses, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Forensics error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
