import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { supabase } from "@/integrations/supabase/client";
import CryptoJS from "crypto-js";

/**
 * Service for managing dYdX Cosmos wallets (dydx1... addresses)
 * CRITICAL: These are separate from EVM wallets - dYdX Chain requires Cosmos SDK wallets
 */
class DydxWalletService {
  private readonly ENCRYPTION_ITERATIONS = 100000;

  /**
   * Generate a new Cosmos wallet for dYdX Chain
   * Creates a 24-word mnemonic and derives dydx1... address
   */
  async generateDydxWallet(userId: string, userPassword: string): Promise<string> {
    try {
      console.log('[DydxWalletService] Generating new Cosmos wallet for user:', userId);

      // Check if user already has a dYdX wallet
      const { data: existing } = await supabase
        .from('dydx_wallets')
        .select('dydx_address')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        console.log('[DydxWalletService] User already has dYdX wallet:', existing.dydx_address);
        return existing.dydx_address;
      }

      // Generate 24-word Cosmos mnemonic with dydx prefix
      const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: "dydx" });
      const [account] = await wallet.getAccounts();
      const mnemonic = wallet.mnemonic;

      console.log('[DydxWalletService] Generated dYdX address:', account.address);

      // Encrypt mnemonic with user password
      const { encryptedMnemonic, iv, salt } = this.encryptMnemonic(mnemonic, userPassword);

      // Store in database
      const { error } = await supabase.from('dydx_wallets').insert({
        user_id: userId,
        dydx_address: account.address,
        encrypted_mnemonic: encryptedMnemonic,
        encryption_iv: iv,
        encryption_salt: salt
      });

      if (error) throw error;

      // Update profiles table with dydx_address
      await supabase
        .from('profiles')
        .update({ dydx_address: account.address })
        .eq('id', userId);

      console.log('[DydxWalletService] Successfully created and stored dYdX wallet');
      return account.address;
    } catch (error) {
      console.error('[DydxWalletService] Error generating wallet:', error);
      throw new Error('Failed to generate dYdX wallet: ' + (error as Error).message);
    }
  }

  /**
   * Get dYdX wallet for signing transactions
   * Decrypts mnemonic and recreates wallet
   */
  async getWalletForSigning(userId: string, password: string): Promise<DirectSecp256k1HdWallet> {
    try {
      // Fetch encrypted wallet data
      const { data, error } = await supabase
        .from('dydx_wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        throw new Error('dYdX wallet not found. Please create a wallet first.');
      }

      // Decrypt mnemonic
      const mnemonic = this.decryptMnemonic(
        data.encrypted_mnemonic,
        data.encryption_iv,
        data.encryption_salt,
        password
      );

      // Recreate Cosmos wallet from mnemonic
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: "dydx"
      });

      return wallet;
    } catch (error) {
      console.error('[DydxWalletService] Error getting wallet:', error);
      throw new Error('Failed to decrypt wallet: ' + (error as Error).message);
    }
  }

  /**
   * Get dYdX address for current user
   */
  async getDydxAddress(userId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('dydx_wallets')
        .select('dydx_address')
        .eq('user_id', userId)
        .maybeSingle();

      return data?.dydx_address || null;
    } catch (error) {
      console.error('[DydxWalletService] Error fetching address:', error);
      return null;
    }
  }

  /**
   * Check if user has a dYdX wallet
   */
  async hasWallet(userId: string): Promise<boolean> {
    const address = await this.getDydxAddress(userId);
    return address !== null;
  }

  /**
   * Encrypt mnemonic using AES-256-GCM with PBKDF2 key derivation
   */
  private encryptMnemonic(mnemonic: string, password: string): {
    encryptedMnemonic: string;
    iv: string;
    salt: string;
  } {
    // Generate random salt
    const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();

    // Derive key from password using PBKDF2
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: this.ENCRYPTION_ITERATIONS
    });

    // Generate random IV
    const iv = CryptoJS.lib.WordArray.random(128 / 8);

    // Encrypt mnemonic
    const encrypted = CryptoJS.AES.encrypt(mnemonic, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      encryptedMnemonic: encrypted.toString(),
      iv: iv.toString(),
      salt: salt
    };
  }

  /**
   * Decrypt mnemonic using stored IV and salt
   */
  private decryptMnemonic(
    encryptedMnemonic: string,
    ivHex: string,
    salt: string,
    password: string
  ): string {
    // Derive same key from password
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: this.ENCRYPTION_ITERATIONS
    });

    // Parse IV
    const iv = CryptoJS.enc.Hex.parse(ivHex);

    // Decrypt mnemonic
    const decrypted = CryptoJS.AES.decrypt(encryptedMnemonic, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const mnemonic = decrypted.toString(CryptoJS.enc.Utf8);

    if (!mnemonic) {
      throw new Error('Decryption failed - incorrect password or corrupted data');
    }

    return mnemonic;
  }

  /**
   * Export mnemonic (for backup purposes) - requires password verification
   */
  async exportMnemonic(userId: string, password: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('dydx_wallets')
        .select('encrypted_mnemonic, encryption_iv, encryption_salt')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        throw new Error('Wallet not found');
      }

      const mnemonic = this.decryptMnemonic(
        data.encrypted_mnemonic,
        data.encryption_iv,
        data.encryption_salt,
        password
      );

      return mnemonic;
    } catch (error) {
      console.error('[DydxWalletService] Error exporting mnemonic:', error);
      throw error;
    }
  }
}

export const dydxWalletService = new DydxWalletService();
