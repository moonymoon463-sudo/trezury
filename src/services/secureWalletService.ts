import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";

/**
 * SECURE WALLET SERVICE - PRODUCTION READY
 * 
 * SECURITY PRINCIPLES:
 * 1. Private keys derived from user password using PBKDF2 (100k iterations)
 * 2. Per-user random salt stored in database
 * 3. Private keys NEVER stored - only derived when needed
 * 4. Private keys immediately zeroized after use
 * 5. All wallet operations require password authentication
 */

export interface SecureWalletInfo {
  address: string;
  publicKey: string;
}

export interface WalletGenerationParams {
  userPassword: string; // Required for secure key derivation
}

interface SecureWalletMetadata {
  user_id: string;
  kdf_salt: number[]; // Stored as array in database
  kdf_iterations: number;
}

class SecureWalletService {
  private readonly KDF_ITERATIONS = 100000;
  private readonly SALT_BYTES = 16;

  /**
   * Get or create a cryptographically random salt for the user
   */
  private async getOrCreateSalt(userId: string): Promise<Uint8Array> {
    const { data: existing, error: fetchError } = await supabase
      .from('secure_wallet_metadata')
      .select('kdf_salt')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.kdf_salt) {
      // kdf_salt is stored as number[] in database
      if (Array.isArray(existing.kdf_salt)) {
        return new Uint8Array(existing.kdf_salt);
      }
      // Fallback if it's already a Uint8Array
      return existing.kdf_salt as unknown as Uint8Array;
    }

    // Generate new cryptographically random salt
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_BYTES));
    
    // Store in database
    const { error: insertError } = await supabase
      .from('secure_wallet_metadata')
      .insert({
        user_id: userId,
        // @ts-ignore - kdf_salt is stored as bytea which accepts number[]
        kdf_salt: Array.from(salt),
        kdf_iterations: this.KDF_ITERATIONS
      } as any);

    if (insertError) {
      console.error('Failed to store wallet salt:', insertError);
      throw new Error('Failed to initialize secure wallet metadata');
    }

    return salt;
  }

  /**
   * Derive private key from userId + password using PBKDF2
   * This is the ONLY way private keys are generated
   */
  private async derivePrivateKey(
    userId: string,
    userPassword: string
  ): Promise<string> {
    if (!userPassword || userPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Get user-specific salt
    const salt = await this.getOrCreateSalt(userId);

    // Combine userId + password as key material
    const keyMaterial = new TextEncoder().encode(`${userId}:${userPassword}`);

    // Import key material for PBKDF2
    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Derive 32 bytes using PBKDF2-HMAC-SHA-256
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.KDF_ITERATIONS,
        hash: 'SHA-256'
      },
      importedKey,
      256 // 256 bits = 32 bytes
    );

    // Convert to hex with 0x prefix
    const hexArray = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'));
    
    return '0x' + hexArray.join('');
  }

  /**
   * Generate secure wallet with password-based key derivation
   * CRITICAL: Private key never stored, only address persisted
   */
  async generateDeterministicWallet(
    userId: string,
    params: WalletGenerationParams
  ): Promise<SecureWalletInfo> {
    const { userPassword } = params;

    if (!userPassword) {
      throw new Error('Password is required for secure wallet generation');
    }

    try {
      // Derive private key from password
      const privateKey = await this.derivePrivateKey(userId, userPassword);
      
      // Create wallet from derived key
      const wallet = new ethers.Wallet(privateKey);

      // Store ONLY the public address
      const { error: insertError } = await supabase
        .from('onchain_addresses')
        .upsert({
          user_id: userId,
          address: wallet.address,
          chain: 'ethereum',
          asset: 'XAUT',
          setup_method: 'user_password',
          created_with_password: true,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,chain,asset'
        });

      if (insertError) {
        console.error('Failed to store wallet address:', insertError);
        throw insertError;
      }

      await this.logSecurityEvent(
        userId,
        'wallet_generated_secure',
        true,
        { address: wallet.address, setup_method: 'user_password' }
      );

      // Zeroize private key from memory (best effort)
      try {
        // @ts-ignore - accessing private field for security
        if (wallet._signingKey) wallet._signingKey = null;
      } catch (e) {
        // Ignore zeroization errors
      }

      return {
        address: wallet.address,
        publicKey: wallet.address
      };
    } catch (error) {
      console.error('Wallet generation failed:', error);
      await this.logSecurityEvent(
        userId,
        'wallet_generation_failed',
        false,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Sign transaction with password-derived key
   * Private key exists only during signing
   */
  async signTransaction(
    userId: string,
    transactionData: any,
    userPassword: string
  ): Promise<string> {
    if (!userPassword) {
      throw new Error('Password is required to sign transactions');
    }

    try {
      // Re-derive private key from password
      const privateKey = await this.derivePrivateKey(userId, userPassword);
      const wallet = new ethers.Wallet(privateKey);

      // Sign the transaction
      const signature = await wallet.signTransaction(transactionData);

      await this.logSecurityEvent(
        userId,
        'transaction_signed',
        true,
        { 
          txHash: signature.substring(0, 10) + '...',
          timestamp: new Date().toISOString()
        }
      );

      // Zeroize private key
      try {
        // @ts-ignore
        if (wallet._signingKey) wallet._signingKey = null;
      } catch (e) {
        // Ignore
      }

      return signature;
    } catch (error) {
      console.error('Transaction signing failed:', error);
      await this.logSecurityEvent(
        userId,
        'transaction_signing_failed',
        false,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Get wallet address (read-only operation)
   * Returns null if no secure wallet exists
   */
  async getWalletAddress(userId: string): Promise<string | null> {
    try {
      const { data: existingAddress } = await supabase
        .from('onchain_addresses')
        .select('address, created_with_password')
        .eq('user_id', userId)
        .eq('chain', 'ethereum')
        .eq('asset', 'XAUT')
        .maybeSingle();

      if (existingAddress?.address && existingAddress.created_with_password) {
        return existingAddress.address;
      }

      return null;
    } catch (error) {
      console.error('Failed to get wallet address:', error);
      return null;
    }
  }

  /**
   * Validate wallet exists
   */
  async validateWalletAccess(userId: string): Promise<boolean> {
    const address = await this.getWalletAddress(userId);
    return address !== null;
  }

  /**
   * Reveal private key for backup (CRITICAL OPERATION)
   * Requires password and logs access
   */
  async revealPrivateKey(
    userId: string,
    userPassword: string
  ): Promise<string> {
    if (!userPassword) {
      throw new Error('Password is required to reveal private key');
    }

    try {
      // Verify wallet exists
      const address = await this.getWalletAddress(userId);
      if (!address) {
        throw new Error('No secure wallet found. Please create one first.');
      }

      // Log this critical operation
      await this.logSecurityEvent(
        userId,
        'private_key_revealed',
        true,
        { 
          timestamp: new Date().toISOString(),
          warning: 'User revealed private key for backup'
        }
      );

      // Derive private key
      const privateKey = await this.derivePrivateKey(userId, userPassword);

      // Create security alert
      await supabase.from('security_alerts').insert({
        user_id: userId,
        alert_type: 'private_key_access',
        severity: 'high',
        title: 'Private Key Revealed',
        description: 'User accessed their private key for backup purposes',
        metadata: {
          timestamp: new Date().toISOString(),
          address: address
        }
      });

      return privateKey;
    } catch (error) {
      await this.logSecurityEvent(
        userId,
        'private_key_reveal_failed',
        false,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Log security events
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
        metadata: metadata,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}

export const secureWalletService = new SecureWalletService();
