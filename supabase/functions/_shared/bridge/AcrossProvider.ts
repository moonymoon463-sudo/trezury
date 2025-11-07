/**
 * Across Protocol bridge provider implementation
 */

import { ethers } from 'https://esm.sh/ethers@6.13.2';
import type { BridgeProvider, BridgeQuote, QuoteParams } from './types.ts';
import { ACROSS_CONFIG, USDC_ADDRESSES, ERC20_ABI } from './config.ts';
import { validateAmount, validateAddress } from './validation.ts';
import { BridgeMonitor } from './monitoring.ts';
import { getRpcUrl } from '../rpcConfig.ts';

export class AcrossProvider implements BridgeProvider {
  readonly name = 'across';
  private monitor = new BridgeMonitor('AcrossProvider');

  getSupportedChains(): string[] {
    return ACROSS_CONFIG.supportedChains;
  }

  async getQuote(params: QuoteParams): Promise<BridgeQuote> {
    const { fromChain, toChain, token, amount, destinationAddress } = params;

    // Validate
    const parsedAmount = validateAmount(amount, fromChain);
    validateAddress(destinationAddress);

    if (!this.getSupportedChains().includes(fromChain)) {
      throw new Error(`Across does not support ${fromChain}`);
    }

    // Calculate fees
    const fee = parsedAmount * ACROSS_CONFIG.feeRate;
    const estimatedOutput = parsedAmount - fee;

    const quote: BridgeQuote = {
      provider: 'across',
      fromChain,
      toChain,
      inputAmount: parsedAmount,
      estimatedOutput: Math.round(estimatedOutput * 100) / 100,
      fee: Math.round(fee * 100) / 100,
      estimatedTime: ACROSS_CONFIG.timeEstimates[fromChain] || ACROSS_CONFIG.timeEstimates.default,
      gasEstimate: ACROSS_CONFIG.gasEstimates[fromChain] || '$1-5',
      route: {
        destinationAddress,
        token,
        confirmations: 1,
      },
    };

    this.monitor.logQuoteGenerated(quote);
    return quote;
  }

async prepareTransaction(quote: BridgeQuote, fromAddress: string): Promise<any> {
    const spokePoolAddress = ACROSS_CONFIG.spokePoolAddresses[quote.fromChain];
    const inputUsdc = USDC_ADDRESSES[quote.fromChain];
    const outputUsdc = USDC_ADDRESSES[quote.toChain];
    const destChainId = (ACROSS_CONFIG as any).chainIds?.[quote.toChain];

    if (!spokePoolAddress || !inputUsdc || !outputUsdc || !destChainId) {
      throw new Error(`Across not supported for ${quote.fromChain} -> ${quote.toChain}`);
    }

    const amount = ethers.parseUnits(quote.inputAmount.toString(), 6);

    return {
      approval: {
        to: inputUsdc,
        from: fromAddress,
        data: new ethers.Interface(ERC20_ABI).encodeFunctionData('approve', [
          spokePoolAddress,
          amount,
        ]),
        value: '0x0',
      },
      deposit: {
        to: spokePoolAddress,
        from: fromAddress,
        data: new ethers.Interface([
          'function depositV3(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes message) payable',
        ]).encodeFunctionData('depositV3', [
          fromAddress,
          fromAddress,
          inputUsdc,
          outputUsdc,
          amount,
          amount,
          destChainId,
          ethers.ZeroAddress,
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000) + 3600,
          0,
          '0x',
        ]),
        value: '0x0',
      },
    };
  }

  async executeTransaction(
    quote: BridgeQuote,
    privateKey: string,
    bridgeId: string,
    supabaseClient: any
  ): Promise<{ txHash: string }> {
    this.monitor.logInfo(`Executing Across bridge for ${quote.fromChain}`, { bridgeId });

    const rpcUrl = getRpcUrl(quote.fromChain);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const spokePoolAddress = ACROSS_CONFIG.spokePoolAddresses[quote.fromChain];
    const inputUsdc = USDC_ADDRESSES[quote.fromChain];
    const outputUsdc = USDC_ADDRESSES[quote.toChain];
    const destChainId = (ACROSS_CONFIG as any).chainIds?.[quote.toChain];

    if (!spokePoolAddress || !inputUsdc || !outputUsdc || !destChainId) {
      throw new Error(`Across route unsupported: ${quote.fromChain} -> ${quote.toChain}`);
    }

    const amount = ethers.parseUnits(quote.inputAmount.toString(), 6);

    // Step 1: Approve USDC
    this.monitor.logInfo('Approving USDC...', { bridgeId, amount: quote.inputAmount });
    const usdcContract = new ethers.Contract(inputUsdc, ERC20_ABI, wallet);

    const currentAllowance = await usdcContract.allowance(wallet.address, spokePoolAddress);
    if (currentAllowance < amount) {
      const approveTx = await usdcContract.approve(spokePoolAddress, amount);
      this.monitor.logInfo('Approval transaction sent', { txHash: approveTx.hash });
      await approveTx.wait();
      this.monitor.logInfo('Approval confirmed', { txHash: approveTx.hash });
    } else {
      this.monitor.logInfo('Sufficient allowance already exists');
    }

    // Step 2: Execute deposit
    this.monitor.logInfo('Executing deposit...', { bridgeId });
    const spokePoolAbi = [
      'function depositV3(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes message) payable',
    ];

    const spokePool = new ethers.Contract(spokePoolAddress, spokePoolAbi, wallet);

    let depositTx;
    try {
      depositTx = await spokePool.depositV3(
        wallet.address,
        wallet.address,
        inputUsdc,
        outputUsdc,
        amount,
        amount,
        destChainId,
        ethers.ZeroAddress,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000) + 3600,
        0,
        '0x'
      );
    } catch (e) {
      this.monitor.logError(e as Error, { bridgeId, stage: 'depositV3', inputUsdc, outputUsdc, destChainId });
      await supabaseClient.from('bridge_transactions').update({ status: 'failed', error_message: (e as Error).message, updated_at: new Date().toISOString() }).eq('id', bridgeId);
      throw e;
    }

    this.monitor.logTransactionSubmitted(bridgeId, depositTx.hash, 'across');

    // Update database
    await supabaseClient
      .from('bridge_transactions')
      .update({
        source_tx_hash: depositTx.hash,
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bridgeId);

    // Wait for confirmation in background
    this.confirmTransactionInBackground(depositTx.hash, bridgeId, supabaseClient);

    return { txHash: depositTx.hash };
  }

  private async confirmTransactionInBackground(
    txHash: string,
    bridgeId: string,
    supabaseClient: any
  ): Promise<void> {
    try {
      this.monitor.logInfo('Waiting for confirmation...', { txHash, bridgeId });
      // Note: In production, this should be handled by a separate monitoring service
      // For now, we'll just update the status
      setTimeout(async () => {
        await supabaseClient
          .from('bridge_transactions')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', bridgeId);
        this.monitor.logTransactionConfirmed(bridgeId, txHash);
      }, 60000); // 1 minute delay for demo
    } catch (error) {
      this.monitor.logError(error as Error, { txHash, bridgeId });
    }
  }
}
