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
        note: 'Funds will arrive on Arbitrum. Use Hyperliquid official bridge to complete transfer.',
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

    // Get provider and execute transaction
    this.monitor.logInfo('Starting bridge transaction execution', { 
      bridgeId: bridgeData.id, 
      provider: quote.provider,
      amount: quote.inputAmount 
    });
    
    const provider = ProviderFactory.getProvider(quote.provider);
    const result = await provider.executeTransaction(quote, privateKey, bridgeData.id, supabaseClient);

    this.monitor.logInfo('Bridge transaction executed successfully', { 
      bridgeId: bridgeData.id, 
      txHash: result.txHash 
    });

    return {
      success: true,
      bridgeId: bridgeData.id,
      txHash: result.txHash,
      estimatedCompletion: bridgeData.estimated_completion,
      note: 'Funds will arrive on Arbitrum. You must then use Hyperliquid official bridge to complete transfer.',
    };
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
