/**
 * Bridge orchestrator - coordinates all bridge operations
 */

import type {
  BridgeQuote,
  QuoteParams,
  BridgeExecutionParams,
  BridgeExecutionResult,
} from './types.ts';
import { ProviderFactory } from './ProviderFactory.ts';
import { validateQuoteRequest, validateExecutionRequest } from './validation.ts';
import { BridgeMonitor } from './monitoring.ts';
import { decryptPrivateKey } from '../encryption.ts';

export class BridgeOrchestrator {
  private monitor = new BridgeMonitor('BridgeOrchestrator');

  /**
   * Get a bridge quote
   */
  async getQuote(params: QuoteParams): Promise<BridgeQuote> {
    this.monitor.logQuoteRequest(params);

    // Validate request
    validateQuoteRequest(params);

    // Get provider and generate quote
    const provider = ProviderFactory.getProvider(params.provider as 'across' | 'wormhole');
    const quote = await provider.getQuote(params);

    return quote;
  }

  /**
   * Execute a bridge transaction
   */
  async executeBridge(
    userId: string,
    params: BridgeExecutionParams,
    supabaseClient: any
  ): Promise<BridgeExecutionResult> {
    this.monitor.logInfo('Starting bridge execution', { userId });

    // Validate request
    validateExecutionRequest(params);

    const { quote, sourceWalletAddress, sourceWalletType, password } = params;

    // Handle external wallets - return unsigned transaction
    if (sourceWalletType === 'external') {
      return await this.prepareExternalWalletBridge(userId, quote, sourceWalletAddress, supabaseClient);
    }

    // Handle internal wallets - execute transaction
    return await this.executeInternalWalletBridge(
      userId,
      quote,
      sourceWalletAddress,
      password!,
      supabaseClient
    );
  }

  /**
   * Prepare unsigned transaction for external wallet
   */
  private async prepareExternalWalletBridge(
    userId: string,
    quote: BridgeQuote,
    sourceWalletAddress: string,
    supabaseClient: any
  ): Promise<BridgeExecutionResult> {
    this.monitor.logInfo('Preparing external wallet bridge', { userId, provider: quote.provider });

    // Create bridge record
    const { data: bridgeRecord, error: insertError } = await supabaseClient
      .from('bridge_transactions')
      .insert({
        user_id: userId,
        bridge_provider: quote.provider,
        source_chain: quote.fromChain,
        destination_chain: quote.toChain,
        amount: quote.inputAmount,
        status: 'awaiting_signature',
        metadata: {
          estimatedFee: quote.fee,
          estimatedOutput: quote.estimatedOutput,
          sourceWalletAddress,
          externalWallet: true,
          note: 'Funds will arrive on Arbitrum. Use Hyperliquid official bridge to complete transfer.',
        },
      })
      .select()
      .single();

    if (insertError) {
      this.monitor.logError(insertError, { userId, provider: quote.provider });
      throw insertError;
    }

    // Get provider and prepare unsigned transaction
    const provider = ProviderFactory.getProvider(quote.provider);
    const unsignedTx = await provider.prepareTransaction(quote, sourceWalletAddress);

    return {
      success: true,
      bridgeId: bridgeRecord.id,
      requiresSignature: true,
      unsignedTransaction: unsignedTx,
      message: 'Please sign the transaction in your wallet',
      note: 'Funds will arrive on Arbitrum. You must then use Hyperliquid official bridge to complete transfer.',
    };
  }

  /**
   * Execute bridge transaction with internal wallet
   */
  private async executeInternalWalletBridge(
    userId: string,
    quote: BridgeQuote,
    sourceWalletAddress: string,
    password: string,
    supabaseClient: any
  ): Promise<BridgeExecutionResult> {
    this.monitor.logInfo('Executing internal wallet bridge', { userId, provider: quote.provider });

    // Get encrypted wallet data
    const { data: encryptedData, error: encryptError } = await supabaseClient
      .from('encrypted_wallet_keys')
      .select('encrypted_private_key, encryption_iv, encryption_salt')
      .eq('user_id', userId)
      .single();

    if (encryptError || !encryptedData) {
      throw new Error('Wallet private key not found. Please ensure your internal wallet is set up.');
    }

    // Decrypt private key with password
    let privateKey: string;
    try {
      privateKey = await decryptPrivateKey(
        encryptedData.encrypted_private_key,
        password,
        encryptedData.encryption_iv,
        encryptedData.encryption_salt
      );
      this.monitor.logInfo('Private key decrypted successfully');
    } catch (decryptError) {
      this.monitor.logError(decryptError as Error, { operation: 'decrypt_private_key' });
      throw new Error('Incorrect password or wallet decryption failed. Please check your password and try again.');
    }

    const destinationAddress = quote.route.destinationAddress;

    // Record bridge transaction
    const bridgeRecord = {
      user_id: userId,
      source_chain: quote.fromChain,
      destination_chain: 'hyperliquid',
      bridge_provider: quote.provider,
      amount: quote.inputAmount,
      token: 'USDC',
      status: 'pending',
      estimated_completion: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      metadata: {
        quote,
        sourceWalletAddress,
        sourceWalletType: 'internal',
        destinationAddress,
        estimatedOutput: quote.estimatedOutput,
        fee: quote.fee,
        note: 'Two-step bridge: Source → Arbitrum → Hyperliquid L1',
      },
    };

    const { data: bridgeData, error: bridgeError } = await supabaseClient
      .from('bridge_transactions')
      .insert(bridgeRecord)
      .select()
      .single();

    if (bridgeError) {
      this.monitor.logError(bridgeError, { userId, provider: quote.provider });
      throw new Error(`Failed to record bridge transaction: ${bridgeError.message}`);
    }

    this.monitor.logExecutionStart(bridgeData.id, { quote, sourceWalletAddress });

    // Step 1: Execute bridge to Arbitrum
    this.monitor.logInfo('Starting Step 1: Bridge to Arbitrum', { 
      bridgeId: bridgeData.id, 
      provider: quote.provider,
      amount: quote.inputAmount 
    });
    
    const provider = ProviderFactory.getProvider(quote.provider);
    const result = await provider.executeTransaction(quote, privateKey, bridgeData.id, supabaseClient);

    this.monitor.logInfo('Step 1 completed - funds on Arbitrum', { 
      bridgeId: bridgeData.id, 
      txHash: result.txHash 
    });

    // Step 2: Auto-trigger Hyperliquid deposit in background
    this.executeHyperliquidDepositInBackground(
      userId,
      bridgeData.id,
      password,
      quote.estimatedOutput,
      supabaseClient
    );

    return {
      success: true,
      bridgeId: bridgeData.id,
      txHash: result.txHash,
      estimatedCompletion: bridgeData.estimated_completion,
      note: 'Step 1 complete. Depositing to Hyperliquid trading wallet...',
    };
  }

  /**
   * Execute Hyperliquid deposit (Step 2) in background
   */
  private async executeHyperliquidDepositInBackground(
    userId: string,
    bridgeId: string,
    password: string,
    amount: number,
    supabaseClient: any
  ): Promise<void> {
    // Wait for Step 1 to fully settle (2 minutes for Across)
    await new Promise(resolve => setTimeout(resolve, 120000));

    try {
      this.monitor.logInfo('Starting Step 2: Hyperliquid deposit', { bridgeId });

      // Check if already completed
      const { data: bridgeRecord } = await supabaseClient
        .from('bridge_transactions')
        .select('status')
        .eq('id', bridgeId)
        .single();

      if (bridgeRecord?.status === 'completed' || bridgeRecord?.status === 'processing_step2') {
        this.monitor.logInfo('Step 2 already in progress or completed', { bridgeId });
        return;
      }

      // Get Hyperliquid wallet
      const { data: hlWallet, error: hlError } = await supabaseClient
        .from('hyperliquid_wallets')
        .select('address')
        .eq('user_id', userId)
        .single();

      if (hlError || !hlWallet) {
        throw new Error('No Hyperliquid trading wallet found');
      }

      // Get encrypted wallet for Arbitrum
      const { data: encryptedData } = await supabaseClient
        .from('encrypted_wallet_keys')
        .select('encrypted_private_key, encryption_iv, encryption_salt, wallet_address')
        .eq('user_id', userId)
        .single();

      if (!encryptedData) {
        throw new Error('Wallet not found');
      }

      // Decrypt private key
      const privateKey = await decryptPrivateKey(
        encryptedData.encrypted_private_key,
        password,
        encryptedData.encryption_iv,
        encryptedData.encryption_salt
      );

      // Import ethers dynamically
      const { ethers } = await import('https://esm.sh/ethers@6.13.0');
      const { getRpcUrl } = await import('../rpcConfig.ts');

      const provider = new ethers.JsonRpcProvider(getRpcUrl('arbitrum'));
      const wallet = new ethers.Wallet(privateKey, provider);

      const USDC_ARBITRUM = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
      const HYPERLIQUID_DEPOSIT = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7';

      // Check USDC balance
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

      if (balanceUSDC < 1) {
        throw new Error('Insufficient USDC on Arbitrum for Step 2');
      }

      const depositAmount = Math.min(amount, balanceUSDC);
      const depositAmountWei = ethers.parseUnits(depositAmount.toString(), 6);

      // Approve if needed
      const currentAllowance = await usdcContract.allowance(wallet.address, HYPERLIQUID_DEPOSIT);
      if (currentAllowance < depositAmountWei) {
        const approveTx = await usdcContract.approve(HYPERLIQUID_DEPOSIT, depositAmountWei);
        await approveTx.wait();
        this.monitor.logInfo('USDC approved for deposit', { bridgeId });
      }

      // Execute deposit
      const depositContract = new ethers.Contract(
        HYPERLIQUID_DEPOSIT,
        ['function deposit(address token, uint256 amount) external'],
        wallet
      );

      const depositTx = await depositContract.deposit(USDC_ARBITRUM, depositAmountWei);

      // Update status immediately
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

      this.monitor.logInfo('Step 2 deposit submitted', { bridgeId, txHash: depositTx.hash });

      // Wait for confirmation
      const receipt = await depositTx.wait();

      // Mark as completed
      await supabaseClient
        .from('bridge_transactions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bridgeId);

      this.monitor.logInfo('Bridge fully completed', { bridgeId, step2Block: receipt.blockNumber });

    } catch (error) {
      this.monitor.logError(error as Error, { bridgeId, stage: 'step2' });
      
      // Mark as step1_complete so user can retry Step 2
      await supabaseClient
        .from('bridge_transactions')
        .update({
          status: 'step1_complete',
          error_message: `Step 2 failed: ${(error as Error).message}. Funds are safe on Arbitrum.`,
          metadata: {
            step2_failed: true,
            step2_error: (error as Error).message,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', bridgeId);
    }
  }

  /**
   * Check bridge transaction status
   */
  async checkStatus(bridgeId: string, supabaseClient: any): Promise<any> {
    this.monitor.logStatusCheck(bridgeId, 'checking');

    const { data, error } = await supabaseClient
      .from('bridge_transactions')
      .select('*')
      .eq('id', bridgeId)
      .single();

    if (error) {
      this.monitor.logError(error, { bridgeId });
      throw new Error(`Bridge transaction not found: ${error.message}`);
    }

    return {
      status: data.status,
      txHash: data.source_tx_hash,
      destinationTxHash: data.destination_tx_hash,
      error: data.error_message,
      estimatedCompletion: data.estimated_completion,
      metadata: data.metadata,
    };
  }
}
