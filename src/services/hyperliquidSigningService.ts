import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import { supabase } from '@/integrations/supabase/client';
import { signL1Action } from '@nktkas/hyperliquid/signing';
import { HYPERLIQUID_NETWORK } from '@/config/hyperliquid';

class HyperliquidSigningService {
  /**
   * Decrypt and get private key from database
   */
  private async getPrivateKey(userId: string, password: string): Promise<string> {
    const { data, error } = await supabase
      .from('hyperliquid_wallets')
      .select('encrypted_private_key')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Trading wallet not found');
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(data.encrypted_private_key, password);
      const privateKey = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!privateKey || !privateKey.startsWith('0x')) {
        throw new Error('Invalid password or corrupted key');
      }

      return privateKey;
    } catch (err) {
      throw new Error('Failed to decrypt wallet - wrong password?');
    }
  }

  /**
   * Sign Hyperliquid L1 action (orders, cancels, etc.)
   * Uses official Hyperliquid SDK signing method
   * This happens on the FRONTEND for security - password never leaves browser
   */
  async signOrderAction(
    userId: string,
    password: string,
    action: any,
    nonce: number
  ): Promise<{ r: string; s: string; v: number }> {
    const privateKey = await this.getPrivateKey(userId, password);
    
    // Convert private key to ethers wallet for SDK compatibility
    const wallet = new ethers.Wallet(privateKey);

    // Use official Hyperliquid L1 action signing
    const signature = await signL1Action({
      wallet: wallet,
      action,
      nonce,
    });

    return signature;
  }

  /**
   * Verify wallet password without exposing private key
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    try {
      await this.getPrivateKey(userId, password);
      return true;
    } catch {
      return false;
    }
  }
}

export const hyperliquidSigningService = new HyperliquidSigningService();
