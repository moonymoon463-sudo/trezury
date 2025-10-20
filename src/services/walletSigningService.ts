import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wallet Signing Service - Handles secure wallet operations
 * This service provides a clean interface for wallet signing operations
 * without exposing private methods from SecureWalletService
 */
class WalletSigningService {
  private readonly KDF_ITERATIONS = 100000;
  private readonly SALT_BYTES = 16;

  /**
   * Get or create a cryptographically random salt for the user
   */
  private async getOrCreateSalt(userId: string): Promise<Uint8Array> {
    const { data: existing } = await supabase
      .from('secure_wallet_metadata')
      .select('kdf_salt')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.kdf_salt && Array.isArray(existing.kdf_salt)) {
      return new Uint8Array(existing.kdf_salt);
    }

    // Generate new cryptographically random salt
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_BYTES));
    
    // Store in database
    await supabase
      .from('secure_wallet_metadata')
      .insert({
        user_id: userId,
        kdf_salt: Array.from(salt),
        kdf_iterations: this.KDF_ITERATIONS
      } as any);

    return salt;
  }

  /**
   * Derive private key from userId + password using PBKDF2
   */
  private async derivePrivateKey(
    userId: string,
    userPassword: string
  ): Promise<string> {
    if (!userPassword || userPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const salt = await this.getOrCreateSalt(userId);
    const keyMaterial = new TextEncoder().encode(`${userId}:${userPassword}`);

    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: this.KDF_ITERATIONS,
        hash: 'SHA-256'
      },
      importedKey,
      256
    );

    const hexArray = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'));
    
    return '0x' + hexArray.join('');
  }

  /**
   * Get a wallet instance for signing (with proper chain configuration)
   */
  async getWalletForSigning(
    userId: string,
    userPassword: string,
    chainId: number
  ): Promise<ethers.Wallet> {
    const privateKey = await this.derivePrivateKey(userId, userPassword);
    
    const rpcUrl = chainId === 42161 
      ? 'https://arb1.arbitrum.io/rpc'
      : 'https://eth.llamarpc.com';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Wallet(privateKey, provider);
  }

  /**
   * Sign EIP-712 typed data
   * ✅ PHASE 3: SIGNATURE MONITORING
   */
  async signTypedData(
    userId: string,
    userPassword: string,
    chainId: number,
    domain: any,
    types: any,
    message: any
  ): Promise<string> {
    try {
      const wallet = await this.getWalletForSigning(userId, userPassword, chainId);
      const signature = await wallet.signTypedData(domain, types, message);
      
      // ✅ Log successful signature
      supabase.from('signature_attempts').insert({
        user_id: userId,
        success: true,
        chain_id: chainId,
        metadata: {
          domain: domain.name,
          timestamp: Date.now()
        }
      }).then();
      
      return signature;
    } catch (error) {
      // ✅ MONITOR FAILED SIGNATURES
      console.error('❌ Signature failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown signature error';
      
      // Log to database
      supabase.from('signature_attempts').insert({
        user_id: userId,
        success: false,
        chain_id: chainId,
        error_message: errorMessage,
        metadata: {
          domain: domain.name,
          timestamp: Date.now(),
          error_type: error instanceof Error ? error.name : 'UnknownError'
        }
      }).then();
      
      // Alert on repeated failures
      import('@/services/securityMonitoringService').then(({ securityMonitoringService }) => {
        securityMonitoringService.logSecurityEvent({
          event_type: 'signature_failure',
          severity: 'medium',
          user_id: userId,
          event_data: {
            chainId,
            error: errorMessage,
            timestamp: Date.now()
          }
        });
      }).catch();
      
      throw error;
    }
  }
}

export const walletSigningService = new WalletSigningService();
