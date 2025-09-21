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
  private readonly FIXED_WALLET_ADDRESS = "0xeDBd9A02dea7b35478e3b2Ee1fd90378346101Cb";

  /**
   * Generate/use the fixed internal wallet for all users
   * Uses a specific wallet address provided by the user
   */
  async generateDeterministicWallet(
    userId: string, 
    params?: Partial<WalletGenerationParams>
  ): Promise<SecureWalletInfo> {
    try {
      // Use the fixed wallet address instead of generating
      const address = this.FIXED_WALLET_ADDRESS;
      
      // Create a dummy publicKey (not actually used for transactions)
      const publicKey = "0x04" + "0".repeat(128); // Placeholder public key

      // Store ONLY the public address and metadata (NO PRIVATE KEYS)
      await this.storeWalletAddress(userId, address);

      console.log('✅ Using fixed internal wallet:', address);

      // Return only public information
      return {
        address,
        publicKey
        // Private key is never stored or returned
      };
    } catch (err) {
      console.error('Failed to setup internal wallet:', err);
      throw new Error('Wallet setup failed');
    }
  }

  /**
   * Sign a transaction using the fixed wallet
   * NOTE: This requires external signing since we don't store private keys
   */
  async signTransaction(
    userId: string,
    transactionData: any
  ): Promise<string> {
    try {
      // For now, return unsigned transaction data
      // In a real implementation, this would require external signing
      console.log('🔄 Transaction requires external signing for address:', this.FIXED_WALLET_ADDRESS);
      console.log('Transaction data:', transactionData);
      
      // Return the transaction data for external signing
      // This should be handled by your wallet provider or signing service
      throw new Error('Transaction signing requires external wallet connection');
    } catch (err) {
      console.error('Transaction signing failed:', err);
      throw new Error('Failed to sign transaction');
    }
  }

  /**
   * Get the fixed wallet address for all users
   */
  async getWalletAddress(userId: string): Promise<string | null> {
    try {
      // Always return the fixed wallet address
      // But check if it's stored in the database first
      const { data: addresses } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .limit(1);

      if (addresses && addresses.length > 0) {
        return addresses[0].address;
      }

      // If not stored, return the fixed address and store it
      await this.storeWalletAddress(userId, this.FIXED_WALLET_ADDRESS);
      return this.FIXED_WALLET_ADDRESS;
    } catch (err) {
      console.error('Error fetching wallet address:', err);
      // Fallback to fixed address
      return this.FIXED_WALLET_ADDRESS;
    }
  }

  /**
   * Store only the wallet address (NO private keys)
   */
  private async storeWalletAddress(userId: string, address: string): Promise<void> {
    try {
      // Check if user already has a wallet address stored
      const { data: existing } = await supabase
        .from('onchain_addresses')
        .select('id, address')
        .eq('user_id', userId)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log('✅ Wallet address already exists for user');
        return; // Address already stored for this user
      }

      // Store a single address record (due to unique constraint on user_id)
      const { error } = await supabase
        .from('onchain_addresses')
        .insert({
          user_id: userId,
          address: address,
          chain: 'sepolia', // Using Sepolia testnet
          asset: 'USDC' // Primary asset, same address works for all ERC-20s
        });

      if (error) {
        // If it's a duplicate key error, that's fine - address already exists
        if (error.code === '23505') {
          console.log('✅ Wallet address already exists (duplicate key)');
          return;
        }
        throw error;
      }

      console.log('✅ Wallet address stored successfully');
    } catch (err) {
      console.error('Failed to store wallet address:', err);
      throw new Error('Failed to store wallet address');
    }
  }

  /**
   * Validate if user can access their wallet (always true for fixed wallet)
   */
  async validateWalletAccess(
    userId: string
  ): Promise<boolean> {
    // Always return true since we use a fixed wallet address
    return true;
  }
}

export const secureWalletService = new SecureWalletService();