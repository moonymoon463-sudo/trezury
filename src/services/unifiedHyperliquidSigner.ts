import { ethers } from 'ethers';
import { hyperliquidSigningService } from './hyperliquidSigningService';
import { signL1Action } from '@nktkas/hyperliquid/signing';

class UnifiedHyperliquidSigner {
  /**
   * Sign order with whatever wallet is active (MetaMask or generated)
   */
  async signOrderAction(
    walletSource: 'generated' | 'external',
    userId: string,
    password: string | null,
    action: any,
    nonce: number
  ): Promise<{ r: string; s: string; v: number }> {
    
    if (walletSource === 'external') {
      return this.signWithMetaMask(action, nonce);
    } else {
      if (!password) {
        throw new Error('Password required for generated wallet');
      }
      return this.signWithGeneratedWallet(userId, password, action, nonce);
    }
  }
  
  /**
   * Sign using MetaMask with Hyperliquid L1 action signing
   * NOTE: This requires MetaMask to support personal_sign for the properly formatted action
   */
  private async signWithMetaMask(action: any, nonce: number): Promise<{ r: string; s: string; v: number }> {
    const provider = window.ethereum;
    if (!provider) {
      throw new Error('MetaMask not found');
    }
    
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No MetaMask account connected');
    }
    const address = accounts[0];
    
    // Get the private key isn't possible from MetaMask directly
    // We need to use the SDK's signing method which will handle the proper formatting
    // For external wallets, we'll need to request the signature via MetaMask
    
    try {
      // Use the official Hyperliquid SDK signing with MetaMask provider
      const signature = await signL1Action({
        wallet: provider as any, // MetaMask provider
        action,
        nonce,
      });
      
      return signature;
    } catch (error) {
      console.error('[UnifiedHyperliquidSigner] MetaMask signing failed:', error);
      throw new Error('Failed to sign with MetaMask. The action may not be supported.');
    }
  }
  
  /**
   * Sign using generated wallet (existing logic)
   */
  private async signWithGeneratedWallet(
    userId: string, 
    password: string, 
    action: any, 
    nonce: number
  ): Promise<{ r: string; s: string; v: number }> {
    return hyperliquidSigningService.signOrderAction(userId, password, action, nonce);
  }
}

export const unifiedHyperliquidSigner = new UnifiedHyperliquidSigner();
