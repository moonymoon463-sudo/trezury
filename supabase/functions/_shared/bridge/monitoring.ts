/**
 * Monitoring and logging utilities for bridge operations
 */

export class BridgeMonitor {
  private context: string;

  constructor(context: string = 'Bridge') {
    this.context = context;
  }

  logQuoteRequest(params: any): void {
    console.log(`[${this.context}] Quote request:`, {
      provider: params.provider,
      fromChain: params.fromChain,
      amount: params.amount,
      timestamp: new Date().toISOString(),
    });
  }

  logQuoteGenerated(quote: any): void {
    console.log(`[${this.context}] Quote generated:`, {
      provider: quote.provider,
      inputAmount: quote.inputAmount,
      estimatedOutput: quote.estimatedOutput,
      fee: quote.fee,
      timestamp: new Date().toISOString(),
    });
  }

  logExecutionStart(bridgeId: string, params: any): void {
    console.log(`[${this.context}] Execution started:`, {
      bridgeId,
      provider: params.quote?.provider,
      amount: params.quote?.inputAmount,
      walletType: params.sourceWalletType,
      timestamp: new Date().toISOString(),
    });
  }

  logTransactionSubmitted(bridgeId: string, txHash: string, provider: string): void {
    console.log(`[${this.context}] Transaction submitted:`, {
      bridgeId,
      txHash,
      provider,
      timestamp: new Date().toISOString(),
    });
  }

  logTransactionConfirmed(bridgeId: string, txHash: string): void {
    console.log(`[${this.context}] Transaction confirmed:`, {
      bridgeId,
      txHash,
      timestamp: new Date().toISOString(),
    });
  }

  logError(error: Error, context: any): void {
    console.error(`[${this.context}] Error:`, {
      errorMessage: error.message,
      errorName: error.name,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  logWarning(message: string, details?: any): void {
    console.warn(`[${this.context}] Warning: ${message}`, details || {});
  }

  logInfo(message: string, details?: any): void {
    console.log(`[${this.context}] ${message}`, details || {});
  }

  logStatusCheck(bridgeId: string, status: string): void {
    console.log(`[${this.context}] Status check:`, {
      bridgeId,
      status,
      timestamp: new Date().toISOString(),
    });
  }
}
