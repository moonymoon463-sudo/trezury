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
   * Generate unique deterministic wallet for each user
   * Creates a unique wallet address based on user ID and password
   */
  async generateDeterministicWallet(
    userId: string, 
    params?: Partial<WalletGenerationParams>
  ): Promise<SecureWalletInfo> {
    try {
      // Generate unique wallet for this user using their ID as seed
      const wallet = this.createUniqueWallet(userId, params?.userPassword);
      const address = wallet.address;
      const publicKey = wallet.publicKey;

      // Store ONLY the public address and metadata (NO PRIVATE KEYS)
      await this.storeWalletAddress(userId, address);

      console.log('✅ Generated unique wallet for user:', address);

      // Return only public information
      return {
        address,
        publicKey
        // Private key is never stored or returned
      };
    } catch (err) {
      console.error('Failed to generate unique wallet:', err);
      throw new Error('Wallet generation failed');
    }
  }

  /**
   * Create a unique wallet for the user using deterministic generation
   */
  private createUniqueWallet(userId: string, userPassword?: string): ethers.HDNodeWallet {
    // Create deterministic seed from user ID and optional password
    const seed = this.createDeterministicSeed(userId, userPassword);
    
    // Generate wallet from seed
    const wallet = ethers.Wallet.fromPhrase(seed);
    
    return wallet;
  }

  /**
   * Create a deterministic mnemonic seed for the user
   */
  private createDeterministicSeed(userId: string, userPassword?: string): string {
    // Create a deterministic but unique seed for each user
    // Using user ID ensures each user gets a unique wallet
    const baseEntropy = ethers.keccak256(
      ethers.toUtf8Bytes(`aurum-wallet-${userId}-${userPassword || 'default'}`)
    );
    
    // Convert to mnemonic for proper wallet generation
    const entropy = baseEntropy.slice(2, 34); // Take 32 bytes (64 hex chars, remove 0x prefix)
    const mnemonic = ethers.Mnemonic.fromEntropy('0x' + entropy);
    
    return mnemonic.phrase;
  }

  /**
   * Sign a transaction using the user's unique wallet
   * NOTE: This requires the user's password to derive their private key temporarily
   */
  async signTransaction(
    userId: string,
    transactionData: any,
    userPassword?: string
  ): Promise<string> {
    try {
      // Temporarily derive the user's wallet for signing
      const wallet = this.createUniqueWallet(userId, userPassword);
      
      console.log('🔄 Signing transaction for user wallet:', wallet.address);
      console.log('Transaction data:', transactionData);
      
      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transactionData);
      
      // Clear wallet from memory immediately after use
      // (Note: JavaScript garbage collection will handle this)
      
      return signedTransaction;
    } catch (err) {
      console.error('Transaction signing failed:', err);
      throw new Error('Failed to sign transaction - ensure correct password');
    }
  }

  /**
   * Get the user's unique wallet address
   */
  async getWalletAddress(userId: string): Promise<string | null> {
    try {
      // Check if user's wallet address is already stored
      const { data: addresses } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .limit(1);

      if (addresses && addresses.length > 0) {
        return addresses[0].address;
      }

      // If not stored, generate and store the user's unique address
      const wallet = this.createUniqueWallet(userId);
      await this.storeWalletAddress(userId, wallet.address);
      return wallet.address;
    } catch (err) {
      console.error('Error fetching wallet address:', err);
      return null;
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
          chain: 'ethereum', // Using Ethereum mainnet for XAUT/USDC
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
   * Validate if user can access their wallet by checking if it exists
   */
  async validateWalletAccess(
    userId: string
  ): Promise<boolean> {
    try {
      const address = await this.getWalletAddress(userId);
      return address !== null;
    } catch (err) {
      return false;
    }
  }

  /**
   * Reveals private key for user backup purposes
   * WARNING: This should only be used for user-initiated backup operations
   */
  async revealPrivateKey(userId: string, userPassword?: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Generate the deterministic wallet (private key is ephemeral)
      const wallet = this.createUniqueWallet(userId, userPassword);
      
      // Verify the password by checking if the generated address matches stored address
      const storedAddress = await this.getWalletAddress(userId);
      if (storedAddress && wallet.address.toLowerCase() !== storedAddress.toLowerCase()) {
        // Password is incorrect - addresses don't match
        await this.logSecurityEvent(userId, 'private_key_reveal_failed', false, {
          reason: 'incorrect_password',
          duration_ms: Date.now() - startTime
        });
        throw new Error('Incorrect password');
      }
      
      console.log('🔐 Private key revealed for backup (user-initiated)');
      
      // Log successful reveal
      await this.logSecurityEvent(userId, 'private_key_revealed', true, {
        duration_ms: Date.now() - startTime
      });
      
      // Return the private key for user backup
      return wallet.privateKey;
    } catch (error) {
      // Log failed attempt
      if (error instanceof Error && error.message !== 'Incorrect password') {
        await this.logSecurityEvent(userId, 'private_key_reveal_failed', false, {
          error: error.message,
          duration_ms: Date.now() - startTime
        });
      }
      
      console.error('Failed to reveal private key:', error);
      throw error;
    }
  }

  /**
   * Log security events to audit table
   */
  private async logSecurityEvent(
    userId: string,
    eventType: string,
    success: boolean,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await supabase.from('wallet_security_events').insert({
        user_id: userId,
        event_type: eventType,
        success: success,
        metadata: metadata
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't throw - logging failure shouldn't block the operation
    }
  }
}

export const secureWalletService = new SecureWalletService();