/**
 * Wormhole bridge provider implementation
 */

import { ethers } from 'https://esm.sh/ethers@6.13.2';
import type { BridgeProvider, BridgeQuote, QuoteParams } from './types.ts';
import { WORMHOLE_CONFIG, USDC_ADDRESSES, ERC20_ABI } from './config.ts';
import { validateAmount, validateAddress } from './validation.ts';
import { BridgeMonitor } from './monitoring.ts';
import { getRpcUrl } from '../rpcConfig.ts';
import { fetchVAA, parseSequenceFromReceipt, getEmitterAddressEth } from '../wormholeVAA.ts';

// Local Wormhole chain ID constant (replaces SDK import)
const CHAIN_ID_ARBITRUM = 23;

export class WormholeProvider implements BridgeProvider {
  readonly name = 'wormhole';
  private monitor = new BridgeMonitor('WormholeProvider');

  getSupportedChains(): string[] {
    return WORMHOLE_CONFIG.supportedChains;
  }

  async getQuote(params: QuoteParams): Promise<BridgeQuote> {
    const { fromChain, toChain, token, amount, destinationAddress } = params;

    // Validate
    const parsedAmount = validateAmount(amount, fromChain);
    validateAddress(destinationAddress);

    if (!this.getSupportedChains().includes(fromChain)) {
      throw new Error(`Wormhole does not support ${fromChain}`);
    }

    // Calculate fees
    const fee = parsedAmount * WORMHOLE_CONFIG.feeRate;
    const estimatedOutput = parsedAmount - fee;

    const quote: BridgeQuote = {
      provider: 'wormhole',
      fromChain,
      toChain,
      inputAmount: parsedAmount,
      estimatedOutput: Math.round(estimatedOutput * 100) / 100,
      fee: Math.round(fee * 100) / 100,
      estimatedTime: WORMHOLE_CONFIG.timeEstimates[fromChain] || WORMHOLE_CONFIG.timeEstimates.default,
      gasEstimate: WORMHOLE_CONFIG.gasEstimates[fromChain] || '$1-5',
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
    const tokenBridgeAddress = WORMHOLE_CONFIG.tokenBridgeAddresses[quote.fromChain];
    const usdcAddress = USDC_ADDRESSES[quote.fromChain];

    if (!tokenBridgeAddress || !usdcAddress) {
      throw new Error(`Wormhole not supported on ${quote.fromChain}`);
    }

    const amount = ethers.parseUnits(quote.inputAmount.toString(), 6);

    // Dynamically fetch the current Wormhole message fee for this chain
    const rpcUrl = getRpcUrl(quote.fromChain);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tokenBridgeAbi = [
      'function transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64 sequence)',
      'function wormhole() view returns (address)',
    ];
    const tokenBridge = new ethers.Contract(tokenBridgeAddress, tokenBridgeAbi, provider);
    const wormholeAddress = await tokenBridge.wormhole();
    const wormholeAbi = [
      'function messageFee() view returns (uint256)',
    ];
    const wormholeCore = new ethers.Contract(wormholeAddress, wormholeAbi, provider);
    const messageFee = await wormholeCore.messageFee();
    this.monitor.logInfo('Wormhole message fee (prepare)', { feeEth: ethers.formatEther(messageFee) });

    return {
      approval: {
        to: usdcAddress,
        from: fromAddress,
        data: new ethers.Interface(ERC20_ABI).encodeFunctionData('approve', [
          tokenBridgeAddress,
          amount,
        ]),
        value: '0x0',
      },
      transfer: {
        to: tokenBridgeAddress,
        from: fromAddress,
        data: new ethers.Interface([
          'function transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64 sequence)',
        ]).encodeFunctionData('transferTokens', [
          usdcAddress,
          amount,
          CHAIN_ID_ARBITRUM,
          ethers.zeroPadValue(fromAddress, 32),
          0,
          Math.floor(Math.random() * 4294967295),
        ]),
        value: messageFee.toString(),
      },
    };
  }

  async executeTransaction(
    quote: BridgeQuote,
    privateKey: string,
    bridgeId: string,
    supabaseClient: any
  ): Promise<{ txHash: string }> {
    try {
      this.monitor.logInfo(`Executing Wormhole bridge for ${quote.fromChain}`, { bridgeId });

      const rpcUrl = getRpcUrl(quote.fromChain);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tokenBridgeAddress = WORMHOLE_CONFIG.tokenBridgeAddresses[quote.fromChain];
      const usdcAddress = USDC_ADDRESSES[quote.fromChain];

      if (!tokenBridgeAddress || !usdcAddress) {
        throw new Error(`Chain ${quote.fromChain} not supported for Wormhole`);
      }

      const amount = ethers.parseUnits(quote.inputAmount.toString(), 6);

      // Step 1: Approve USDC
      this.monitor.logInfo('Approving USDC...', { bridgeId, amount: quote.inputAmount });
      const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, wallet);

      const currentAllowance = await usdcContract.allowance(wallet.address, tokenBridgeAddress);
      if (currentAllowance < amount) {
        const approveTx = await usdcContract.approve(tokenBridgeAddress, amount);
        this.monitor.logInfo('Approval transaction sent', { txHash: approveTx.hash });
        await approveTx.wait();
        this.monitor.logInfo('Approval confirmed', { txHash: approveTx.hash });
      } else {
        this.monitor.logInfo('Sufficient allowance already exists');
      }

      // Step 2: Execute Wormhole transfer
      this.monitor.logInfo('Executing Wormhole transfer...', { bridgeId });
      const tokenBridgeAbi = [
        'function transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64 sequence)',
        'function wormhole() view returns (address)',
      ];

      const tokenBridge = new ethers.Contract(tokenBridgeAddress, tokenBridgeAbi, wallet);

      // Query the current message fee from Wormhole core contract
      const wormholeAddress = await tokenBridge.wormhole();
      const wormholeAbi = [
        'function messageFee() view returns (uint256)',
      ];
      const wormholeCore = new ethers.Contract(wormholeAddress, wormholeAbi, wallet);
      const messageFee = await wormholeCore.messageFee();
      
      this.monitor.logInfo('Wormhole message fee', { messageFee: ethers.formatEther(messageFee), bridgeId });

      const transferTx = await tokenBridge.transferTokens(
        usdcAddress,
        amount,
        CHAIN_ID_ARBITRUM,
        ethers.zeroPadValue(wallet.address, 32),
        0,
        Math.floor(Math.random() * 4294967295),
        { value: messageFee }
      );

      this.monitor.logTransactionSubmitted(bridgeId, transferTx.hash, 'wormhole');

      // Update database
      await supabaseClient
        .from('bridge_transactions')
        .update({
          transaction_hash: transferTx.hash,
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bridgeId);

      // Wait for receipt and fetch VAA in background
      this.processVAAInBackground(
        transferTx.hash,
        quote.fromChain,
        tokenBridgeAddress,
        bridgeId,
        provider,
        supabaseClient
      );

      return { txHash: transferTx.hash };
    } catch (error) {
      // Log and update database with error
      this.monitor.logError(error as Error, { bridgeId, operation: 'executeTransaction' });
      
      await supabaseClient
        .from('bridge_transactions')
        .update({
          status: 'failed',
          error: (error as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bridgeId)
        .then(() => this.monitor.logInfo('Database updated with failure status', { bridgeId }))
        .catch((dbError: Error) => this.monitor.logError(dbError, { bridgeId, operation: 'updateFailureStatus' }));

      throw error;
    }
  }

  private async processVAAInBackground(
    txHash: string,
    sourceChain: string,
    tokenBridgeAddress: string,
    bridgeId: string,
    provider: any,
    supabaseClient: any
  ): Promise<void> {
    try {
      this.monitor.logInfo('Waiting for transaction receipt...', { txHash, bridgeId });
      
      const receipt = await provider.waitForTransaction(txHash);
      this.monitor.logInfo('Transaction confirmed', { txHash, bridgeId });

      // Parse sequence from receipt
      const sequence = parseSequenceFromReceipt(receipt, tokenBridgeAddress);
      this.monitor.logInfo('Sequence extracted', { sequence, bridgeId });

      // Get emitter address
      const emitterAddress = getEmitterAddressEth(tokenBridgeAddress);
      const chainId = WORMHOLE_CONFIG.chainIds[sourceChain];

      this.monitor.logInfo('Fetching VAA...', { emitterAddress, sequence, bridgeId });

      // Fetch VAA (this can take several minutes)
      const vaa = await fetchVAA(chainId, emitterAddress, sequence);

      this.monitor.logInfo('VAA fetched successfully', { bridgeId });

      // Update database with VAA
      await supabaseClient
        .from('bridge_transactions')
        .update({
          status: 'completed',
          vaa_bytes: vaa.vaaBytes,
          updated_at: new Date().toISOString(),
          metadata: {
            sequence,
            emitterAddress,
            vaaFetched: true,
          },
        })
        .eq('id', bridgeId);

      this.monitor.logTransactionConfirmed(bridgeId, txHash);
    } catch (error) {
      this.monitor.logError(error as Error, { txHash, bridgeId });
      
      // Update database with error
      await supabaseClient
        .from('bridge_transactions')
        .update({
          status: 'failed',
          error_message: (error as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bridgeId);
    }
  }
}
