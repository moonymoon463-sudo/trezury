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
   * Get private key - tries decryption first, falls back to derivation
   * This handles both encrypted wallets and deterministic wallets
   */
  private async getPrivateKey(
    userId: string,
    userPassword: string
  ): Promise<string> {
    // Try to get encrypted wallet first
    try {
      const { data } = await supabase
        .from('encrypted_wallet_keys')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.encrypted_private_key) {
        // Decrypt with password or legacy userId
        return await this.decryptPrivateKey(userId, userPassword);
      }
    } catch (error) {
      console.warn('Failed to decrypt wallet, falling back to derivation:', error);
    }

    // Fallback to deterministic derivation
    return await this.derivePrivateKey(userId, userPassword);
  }

  /**
   * Decrypt private key from database
   */
  private async decryptPrivateKey(
    userId: string,
    password: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('encrypted_wallet_keys')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      throw new Error('Encrypted wallet not found');
    }
    
    const salt = new Uint8Array(
      atob(data.encryption_salt).split('').map(c => c.charCodeAt(0))
    );
    const iv = new Uint8Array(
      atob(data.encryption_iv).split('').map(c => c.charCodeAt(0))
    );
    
    // Determine decryption password
    let decryptionPassword: string;
    if (data.encryption_method === 'legacy_userid') {
      decryptionPassword = userId;
    } else {
      decryptionPassword = password;
    }
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(decryptionPassword),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.KDF_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const encryptedData = new Uint8Array(
      atob(data.encrypted_private_key).split('').map(c => c.charCodeAt(0))
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
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
    const privateKey = await this.getPrivateKey(userId, userPassword);
    
    const rpcUrl = chainId === 42161 
      ? 'https://arb1.arbitrum.io/rpc'
      : 'https://eth.llamarpc.com';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Wallet(privateKey, provider);
  }

  /**
   * Sign EIP-712 typed data
   * Automatically sanitizes types to avoid ethers v6 ambiguity errors
   */
  async signTypedData(
    userId: string,
    userPassword: string,
    chainId: number,
    domain: any,
    types: any,
    message: any
  ): Promise<string> {
    // Helper: build minimal types set based on message shape
    const buildSanitizedTypes = (rawTypes: any, value: any) => {
      const t = { ...rawTypes };
      // Remove EIP712Domain if present (ethers v6 expects it omitted)
      if (t.EIP712Domain) delete t.EIP712Domain;

      // Detect primary type by message keys
      const isPermit2 = (value && typeof value === 'object' && 'permitted' in value && 'spender' in value);
      const isPermit = (value && typeof value === 'object' && 'owner' in value && 'spender' in value && 'value' in value);

      if (isPermit2 && (t.PermitTransferFrom || t.PermitSingle)) {
        // Keep only PermitTransferFrom (v2) and its dependency TokenPermissions
        const keep: any = {};
        if (t.TokenPermissions) keep.TokenPermissions = t.TokenPermissions;
        if (t.PermitTransferFrom) keep.PermitTransferFrom = t.PermitTransferFrom;
        return keep;
      }

      if (isPermit && t.Permit) {
        // Legacy ERC-2612 Permit
        return { Permit: t.Permit };
      }

      // Default: return rawTypes without EIP712Domain
      return t;
    };

    try {
      const wallet = await this.getWalletForSigning(userId, userPassword, chainId);
      const sanitizedTypes = buildSanitizedTypes(types, message);

      // Some domains include a non-numeric chainId, ensure numeric
      const sanitizedDomain = { ...domain };
      if (sanitizedDomain.chainId && typeof sanitizedDomain.chainId === 'string') {
        sanitizedDomain.chainId = Number(sanitizedDomain.chainId);
      }

      const signature = await wallet.signTypedData(sanitizedDomain, sanitizedTypes, message);

      // ✅ Log successful signature
      supabase.from('signature_attempts').insert({
        user_id: userId,
        success: true,
        chain_id: chainId,
        metadata: {
          domain: domain?.name ?? 'unknown',
          timestamp: Date.now(),
        },
      }).then();

      return signature;
    } catch (error) {
      console.error('❌ Signature failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown signature error';

      // Log to database
      supabase.from('signature_attempts').insert({
        user_id: userId,
        success: false,
        chain_id: chainId,
        error_message: errorMessage,
        metadata: {
          domain: domain?.name ?? 'unknown',
          timestamp: Date.now(),
          error_type: error instanceof Error ? error.name : 'UnknownError',
        },
      }).then();

      // Security monitoring hook (best-effort)
      import('@/services/securityMonitoringService').then(({ securityMonitoringService }) => {
        securityMonitoringService.logSecurityEvent({
          event_type: 'signature_failure',
          severity: 'medium',
          user_id: userId,
          event_data: { chainId, error: errorMessage, timestamp: Date.now() },
        });
      }).catch();

      throw error;
    }
  }
}

export const walletSigningService = new WalletSigningService();
