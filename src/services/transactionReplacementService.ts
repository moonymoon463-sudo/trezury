/**
 * Transaction Replacement Service
 * Handles stuck transactions by replacing them with higher gas prices
 */

import { ethers } from 'ethers';
import { logger } from '@/utils/logger';

export interface TransactionStatus {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed' | 'stuck';
  confirmations: number;
  submittedAt: Date;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface ReplacementOptions {
  gasPriceIncrease: number; // Percentage increase (e.g., 10 for 10%)
  maxAttempts: number;
  stuckThresholdMs: number; // Time to consider transaction stuck
}

export class TransactionReplacementService {
  private provider: ethers.Provider;
  private pendingTxs = new Map<string, TransactionStatus>();
  
  private defaultOptions: ReplacementOptions = {
    gasPriceIncrease: 10,
    maxAttempts: 3,
    stuckThresholdMs: 5 * 60 * 1000 // 5 minutes
  };

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  async trackTransaction(txHash: string): Promise<void> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      
      if (!tx) {
        logger.warn('Transaction not found', { txHash });
        return;
      }

      this.pendingTxs.set(txHash, {
        txHash,
        status: 'pending',
        confirmations: 0,
        submittedAt: new Date(),
        gasPrice: tx.gasPrice?.toString(),
        maxFeePerGas: tx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString()
      });

      logger.info('Tracking transaction', { txHash });
    } catch (error: any) {
      logger.error('Failed to track transaction', { txHash, error: error.message });
    }
  }

  async checkTransactionStatus(txHash: string): Promise<TransactionStatus | null> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (receipt) {
        const confirmations = await receipt.confirmations();
        const status: TransactionStatus = {
          txHash,
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          confirmations,
          submittedAt: this.pendingTxs.get(txHash)?.submittedAt || new Date()
        };

        this.pendingTxs.delete(txHash);
        return status;
      }

      // Check if transaction is stuck
      const tracked = this.pendingTxs.get(txHash);
      if (tracked) {
        const elapsedMs = Date.now() - tracked.submittedAt.getTime();
        if (elapsedMs > this.defaultOptions.stuckThresholdMs) {
          tracked.status = 'stuck';
          logger.warn('Transaction appears stuck', { 
            txHash, 
            elapsedMinutes: Math.floor(elapsedMs / 60000)
          });
        }
        return tracked;
      }

      return null;
    } catch (error: any) {
      logger.error('Failed to check transaction status', { txHash, error: error.message });
      return null;
    }
  }

  async replaceTransaction(
    originalTx: ethers.TransactionResponse,
    signer: ethers.Signer,
    options?: Partial<ReplacementOptions>
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };

    logger.info('Attempting to replace stuck transaction', {
      originalTxHash: originalTx.hash,
      gasPriceIncrease: opts.gasPriceIncrease
    });

    try {
      // Calculate new gas price
      let newTx: ethers.TransactionRequest = {
        to: originalTx.to,
        value: originalTx.value,
        data: originalTx.data,
        nonce: originalTx.nonce,
        chainId: originalTx.chainId
      };

      // Handle EIP-1559 transactions
      if (originalTx.maxFeePerGas && originalTx.maxPriorityFeePerGas) {
        const increaseMultiplier = (100 + opts.gasPriceIncrease) / 100;
        
        newTx.maxFeePerGas = (originalTx.maxFeePerGas * BigInt(Math.floor(increaseMultiplier * 100))) / 100n;
        newTx.maxPriorityFeePerGas = (originalTx.maxPriorityFeePerGas * BigInt(Math.floor(increaseMultiplier * 100))) / 100n;
        
        logger.info('Replacing with EIP-1559 transaction', {
          originalMaxFee: originalTx.maxFeePerGas.toString(),
          newMaxFee: newTx.maxFeePerGas.toString()
        });
      } 
      // Handle legacy transactions
      else if (originalTx.gasPrice) {
        const increaseMultiplier = (100 + opts.gasPriceIncrease) / 100;
        newTx.gasPrice = (originalTx.gasPrice * BigInt(Math.floor(increaseMultiplier * 100))) / 100n;
        
        logger.info('Replacing with legacy transaction', {
          originalGasPrice: originalTx.gasPrice.toString(),
          newGasPrice: newTx.gasPrice.toString()
        });
      }

      // Send replacement transaction
      const replacementTx = await signer.sendTransaction(newTx);
      
      logger.info('Replacement transaction sent', {
        originalTxHash: originalTx.hash,
        replacementTxHash: replacementTx.hash,
        nonce: replacementTx.nonce
      });

      // Track the replacement
      await this.trackTransaction(replacementTx.hash);

      return replacementTx.hash;
    } catch (error: any) {
      logger.error('Failed to replace transaction', {
        originalTxHash: originalTx.hash,
        error: error.message
      });
      throw error;
    }
  }

  getStuckTransactions(): TransactionStatus[] {
    return Array.from(this.pendingTxs.values()).filter(
      tx => tx.status === 'stuck'
    );
  }

  clearTracking(txHash: string): void {
    this.pendingTxs.delete(txHash);
  }
}
