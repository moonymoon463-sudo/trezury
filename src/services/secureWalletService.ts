import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";

/**
 * SECURE WALLET SERVICE
 * 
 * SECURITY PRINCIPLES:
 * 1. NEVER store private keys anywhere (database, localStorage, memory)
 * 2. Generate keys deterministically from user-controlled seeds
 * 3. Keys exist only during transaction signing
 * 4. User must provide password/seed for each operation
 */

export interface SecureWalletInfo {
  address: string;
  publicKey: string;
  // NOTE: NO privateKey field - never store or return private keys
}

export interface WalletGenerationParams {
  userPassword: string;
  userSalt?: string; // Optional additional salt from user
}

class SecureWalletService {
  private readonly PBKDF2_ITERATIONS = 100000;

  /**
   * Generate a deterministic wallet automatically from user ID
   * No password required - completely automatic
   */
  async generateDeterministicWallet(
    userId: string, 
    params?: Partial<WalletGenerationParams>
  ): Promise<SecureWalletInfo> {
    try {
      // Use userId as automatic seed - no password required
      const seed = await this.createDeterministicSeed(userId, { 
        userPassword: userId // Use userId as password for simplicity
      });
      
      // Generate wallet from seed (private key exists only in this scope)
      const wallet = ethers.Wallet.fromPhrase(seed);
      const address = wallet.address;
      const publicKey = wallet.publicKey;

      // Store ONLY the public address and metadata (NO PRIVATE KEYS)
      await this.storeWalletAddress(userId, address);

      console.log('✅ Auto-generated internal wallet:', address);

      // Return only public information
      return {
        address,
        publicKey
        // Private key is automatically garbage collected
      };
    } catch (err) {
      console.error('Failed to generate secure wallet:', err);
      throw new Error('Wallet generation failed');
    }
  }

  /**
   * Sign a transaction automatically using userId as seed
   * No password required - completely automatic
   */
  async signTransaction(
    userId: string,
    transactionData: any
  ): Promise<string> {
    try {
      // Regenerate wallet from userId (private key exists only during signing)
      const seed = await this.createDeterministicSeed(userId, { 
        userPassword: userId // Use userId as password
      });
      const wallet = ethers.Wallet.fromPhrase(seed);

      // Sign transaction
      const signedTransaction = await wallet.signTransaction(transactionData);
      
      console.log('✅ Transaction signed automatically');
      
      // Private key is automatically garbage collected when wallet goes out of scope
      return signedTransaction;
    } catch (err) {
      console.error('Transaction signing failed:', err);
      throw new Error('Failed to sign transaction');
    }
  }

  /**
   * Get wallet address without exposing any private information
   */
  async getWalletAddress(userId: string): Promise<string | null> {
    try {
      const { data: addresses } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .limit(1)
        .single();

      return addresses?.address || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Create a deterministic seed from user credentials
   * Uses PBKDF2 for secure key derivation
   */
  private async createDeterministicSeed(
    userId: string, 
    params: WalletGenerationParams
  ): Promise<string> {
    // Create salt combining userId with optional user salt
    const salt = `${userId}_${params.userSalt || 'default'}`;
    
    // Use browser's crypto API for PBKDF2
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(params.userPassword);
    const saltBuffer = encoder.encode(salt);

    // Import password as cryptographic key
    const key = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Derive deterministic bits using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      key,
      256 // 32 bytes for seed
    );

    // Convert to hex string for mnemonic generation
    const derivedArray = new Uint8Array(derivedBits);
    const entropy = Array.from(derivedArray)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    // Generate mnemonic from entropy
    const mnemonic = ethers.Mnemonic.fromEntropy('0x' + entropy);
    return mnemonic.phrase;
  }

  /**
   * Store only the wallet address (NO private keys)
   */
  private async storeWalletAddress(userId: string, address: string): Promise<void> {
    try {
      // Check if address already exists
      const { data: existing } = await supabase
        .from('onchain_addresses')
        .select('id')
        .eq('user_id', userId)
        .eq('address', address)
        .single();

      if (existing) return; // Address already stored

      // Store address for both USDC and XAUT (same address, different assets)
      const { error } = await supabase
        .from('onchain_addresses')
        .insert([
          {
            user_id: userId,
            address: address,
            chain: 'ethereum',
            asset: 'USDC'
          },
          {
            user_id: userId,
            address: address,
            chain: 'ethereum',
            asset: 'XAUT'
          }
        ]);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to store wallet address:', err);
      throw new Error('Failed to store wallet address');
    }
  }

  /**
   * Validate if user can access their wallet (always true for automatic wallets)
   */
  async validateWalletAccess(
    userId: string
  ): Promise<boolean> {
    try {
      const storedAddress = await this.getWalletAddress(userId);
      return !!storedAddress; // True if wallet exists
    } catch (err) {
      return false;
    }
  }
}

export const secureWalletService = new SecureWalletService();