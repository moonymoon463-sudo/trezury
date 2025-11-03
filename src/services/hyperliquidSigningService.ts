import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import { supabase } from '@/integrations/supabase/client';

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
   * Sign Hyperliquid order action (EIP-712)
   * This happens on the FRONTEND for security - password never leaves browser
   */
  async signOrderAction(
    userId: string,
    password: string,
    action: any,
    nonce: number
  ): Promise<{ r: string; s: string; v: number }> {
    const privateKey = await this.getPrivateKey(userId, password);
    const wallet = new ethers.Wallet(privateKey);

    const domain = {
      name: 'Exchange',
      version: '1',
      chainId: 421614, // Arbitrum Sepolia (HyperEVM testnet)
      verifyingContract: '0x0000000000000000000000000000000000000000'
    };

    const types = {
      Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' }
      ]
    };

    const message = {
      source: 'a',
      connectionId: ethers.ZeroHash
    };

    const signature = await wallet.signTypedData(domain, types, message);
    const sig = ethers.Signature.from(signature);

    return { r: sig.r, s: sig.s, v: sig.v };
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
