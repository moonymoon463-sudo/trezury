import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ethers } from 'https://esm.sh/ethers@6.13.0';
import { getRpcUrl } from '../_shared/rpcConfig.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, txHashes } = await req.json();

    if (!userId || !txHashes || !Array.isArray(txHashes)) {
      return new Response(
        JSON.stringify({ error: 'userId and txHashes array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Reconciliation] Processing ${txHashes.length} transactions for user ${userId}`);

    const results = [];
    
    for (const txHash of txHashes) {
      try {
        console.log(`[Reconciliation] Processing tx ${txHash}`);
        
        // Try multiple chains to find the transaction
        let txData = null;
        let sourceChain = null;
        
        for (const chain of ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon']) {
          try {
            const provider = new ethers.JsonRpcProvider(getRpcUrl(chain));
            const tx = await provider.getTransaction(txHash);
            if (tx) {
              txData = tx;
              sourceChain = chain;
              console.log(`[Reconciliation] Found tx on ${chain}`);
              break;
            }
          } catch (e) {
            // Try next chain
            continue;
          }
        }

        if (!txData || !sourceChain) {
          console.log(`[Reconciliation] Transaction ${txHash} not found on any chain`);
          results.push({ txHash, status: 'not_found' });
          continue;
        }

        // Get transaction receipt for confirmation status
        const provider = new ethers.JsonRpcProvider(getRpcUrl(sourceChain));
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
          results.push({ txHash, status: 'pending', sourceChain });
          continue;
        }

        // Parse USDC transfer amount from logs
        const usdcInterface = new ethers.Interface([
          'event Transfer(address indexed from, address indexed to, uint256 value)'
        ]);
        
        let amount = 0;
        for (const log of receipt.logs) {
          try {
            const parsed = usdcInterface.parseLog(log);
            if (parsed && parsed.name === 'Transfer') {
              amount = Number(ethers.formatUnits(parsed.args.value, 6));
              break;
            }
          } catch (e) {
            continue;
          }
        }

        console.log(`[Reconciliation] Tx ${txHash}: amount=${amount} USDC, chain=${sourceChain}`);

        // Find matching bridge transaction within 30 minute window
        const txTimestamp = new Date((txData.blockNumber || 0) * 12 * 1000); // Approximate
        const windowStart = new Date(txTimestamp.getTime() - 30 * 60 * 1000);
        const windowEnd = new Date(txTimestamp.getTime() + 30 * 60 * 1000);

        const { data: matches } = await supabaseClient
          .from('bridge_transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .is('source_tx_hash', null)
          .gte('created_at', windowStart.toISOString())
          .lte('created_at', windowEnd.toISOString());

        let matchedRecord = null;
        if (matches && matches.length > 0) {
          // Match by amount (within 1% tolerance)
          for (const record of matches) {
            const recordAmount = record.amount;
            if (Math.abs(recordAmount - amount) / recordAmount < 0.01) {
              matchedRecord = record;
              break;
            }
          }
        }

        if (matchedRecord) {
          // Update record with tx hash
          await supabaseClient
            .from('bridge_transactions')
            .update({
              source_tx_hash: txHash,
              status: 'step1_complete',
              metadata: {
                ...matchedRecord.metadata,
                step1_completed: true,
                arbitrum_arrived: true,
                reconciled_at: new Date().toISOString(),
                source_chain: sourceChain,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', matchedRecord.id);

          console.log(`[Reconciliation] Matched tx ${txHash} to bridge record ${matchedRecord.id}`);
          
          results.push({
            txHash,
            status: 'matched',
            bridgeId: matchedRecord.id,
            amount,
            sourceChain,
            readyForStep2: true,
          });
        } else {
          console.log(`[Reconciliation] No matching bridge record found for tx ${txHash}`);
          results.push({
            txHash,
            status: 'no_match',
            amount,
            sourceChain,
            note: 'Transaction found but no matching pending bridge record',
          });
        }

      } catch (error) {
        console.error(`[Reconciliation] Error processing tx ${txHash}:`, error);
        results.push({
          txHash,
          status: 'error',
          error: error.message,
        });
      }
    }

    // Check Arbitrum balance
    try {
      const { data: wallet } = await supabaseClient
        .from('encrypted_wallet_keys')
        .select('wallet_address')
        .eq('user_id', userId)
        .single();

      if (wallet?.wallet_address) {
        const arbProvider = new ethers.JsonRpcProvider(getRpcUrl('arbitrum'));
        const usdcAddress = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // USDC on Arbitrum
        const usdcContract = new ethers.Contract(
          usdcAddress,
          ['function balanceOf(address) view returns (uint256)'],
          arbProvider
        );
        
        const balance = await usdcContract.balanceOf(wallet.wallet_address);
        const balanceUSDC = Number(ethers.formatUnits(balance, 6));
        
        console.log(`[Reconciliation] Arbitrum USDC balance: ${balanceUSDC}`);
        
        return new Response(
          JSON.stringify({
            success: true,
            results,
            arbitrumBalance: {
              address: wallet.wallet_address,
              usdc: balanceUSDC,
            },
            summary: {
              total: txHashes.length,
              matched: results.filter(r => r.status === 'matched').length,
              readyForStep2: results.filter(r => r.readyForStep2).length,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      console.error('[Reconciliation] Error checking Arbitrum balance:', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: txHashes.length,
          matched: results.filter(r => r.status === 'matched').length,
          readyForStep2: results.filter(r => r.readyForStep2).length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Reconciliation] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
