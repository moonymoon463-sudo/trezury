import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ethers } from 'https://esm.sh/ethers@6.13.0';
import { getRpcUrl } from '../_shared/rpcConfig.ts';
import { decryptPrivateKey } from '../_shared/encryption.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HYPERLIQUID_DEPOSIT_CONTRACT = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7';
const USDC_ARBITRUM = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, bridgeId, password, amount } = await req.json();

    if (!userId || !password) {
      return new Response(
        JSON.stringify({ error: 'userId and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[HyperliquidDeposit] Starting deposit for user ${userId}`);

    // Get Hyperliquid trading wallet address
    const { data: hlWallet, error: hlError } = await supabaseClient
      .from('hyperliquid_wallets')
      .select('address')
      .eq('user_id', userId)
      .single();

    if (hlError || !hlWallet) {
      throw new Error('No Hyperliquid trading wallet found. Please generate one first.');
    }

    console.log(`[HyperliquidDeposit] Target HL wallet: ${hlWallet.address}`);

    // Get encrypted wallet for Arbitrum signing
    const { data: encryptedData, error: walletError } = await supabaseClient
      .from('encrypted_wallet_keys')
      .select('encrypted_private_key, encryption_iv, encryption_salt, wallet_address')
      .eq('user_id', userId)
      .single();

    if (walletError || !encryptedData) {
      throw new Error('Wallet not found');
    }

    // Decrypt private key
    const privateKey = await decryptPrivateKey(
      encryptedData.encrypted_private_key,
      password,
      encryptedData.encryption_iv,
      encryptedData.encryption_salt
    );

    // Connect to Arbitrum
    const provider = new ethers.JsonRpcProvider(getRpcUrl('arbitrum'));
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`[HyperliquidDeposit] Using source wallet: ${wallet.address}`);

    // Get USDC balance on Arbitrum
    const usdcContract = new ethers.Contract(
      USDC_ARBITRUM,
      [
        'function balanceOf(address) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
      ],
      wallet
    );

    const balance = await usdcContract.balanceOf(wallet.address);
    const balanceUSDC = Number(ethers.formatUnits(balance, 6));
    
    console.log(`[HyperliquidDeposit] Arbitrum USDC balance: ${balanceUSDC}`);

    if (balanceUSDC === 0) {
      throw new Error('No USDC balance on Arbitrum to deposit');
    }

    // Use specified amount or full balance
    const depositAmount = amount || balanceUSDC;
    const depositAmountWei = ethers.parseUnits(depositAmount.toString(), 6);

    if (depositAmountWei > balance) {
      throw new Error(`Insufficient balance. Have ${balanceUSDC}, need ${depositAmount}`);
    }

    // Check and approve if needed
    const depositContract = HYPERLIQUID_DEPOSIT_CONTRACT;
    const currentAllowance = await usdcContract.allowance(wallet.address, depositContract);
    
    if (currentAllowance < depositAmountWei) {
      console.log('[HyperliquidDeposit] Approving USDC...');
      const approveTx = await usdcContract.approve(depositContract, depositAmountWei);
      await approveTx.wait();
      console.log(`[HyperliquidDeposit] Approval tx: ${approveTx.hash}`);
    }

    // Execute deposit to Hyperliquid L1
    console.log(`[HyperliquidDeposit] Depositing ${depositAmount} USDC to HL wallet ${hlWallet.address}`);
    
    const depositAbi = [
      'function deposit(address token, uint256 amount) external'
    ];
    
    const hyperliquidDeposit = new ethers.Contract(
      depositContract,
      depositAbi,
      wallet
    );

    const depositTx = await hyperliquidDeposit.deposit(USDC_ARBITRUM, depositAmountWei);
    console.log(`[HyperliquidDeposit] Deposit tx submitted: ${depositTx.hash}`);

    // Update bridge record if provided
    if (bridgeId) {
      await supabaseClient
        .from('bridge_transactions')
        .update({
          destination_tx_hash: depositTx.hash,
          status: 'processing_step2',
          metadata: {
            step2_initiated: true,
            hyperliquid_wallet: hlWallet.address,
            deposit_amount: depositAmount,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', bridgeId);
    }

    // Wait for confirmation
    const receipt = await depositTx.wait();
    console.log(`[HyperliquidDeposit] Deposit confirmed in block ${receipt.blockNumber}`);

    // Update final status
    if (bridgeId) {
      await supabaseClient
        .from('bridge_transactions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bridgeId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        txHash: depositTx.hash,
        amount: depositAmount,
        hyperliquidWallet: hlWallet.address,
        blockNumber: receipt.blockNumber,
        explorerUrl: `https://arbiscan.io/tx/${depositTx.hash}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[HyperliquidDeposit] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
