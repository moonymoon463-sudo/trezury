import { useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { secureWalletService } from '@/services/secureWalletService';

/**
 * Hook to migrate legacy wallets from userId encryption to password-based encryption
 */
export const useWalletMigration = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if user's wallet needs migration from legacy encryption
   */
  const checkNeedsMigration = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data } = await supabase
        .from('encrypted_wallet_keys')
        .select('encryption_method')
        .eq('user_id', user.id)
        .maybeSingle();

      return data?.encryption_method === 'legacy_userid';
    } catch {
      return false;
    }
  };

  /**
   * Migrate wallet from userId encryption to password-based encryption
   * This requires:
   * 1. Decrypting with userId (legacy)
   * 2. Re-encrypting with user's actual password (secure)
   */
  const migrateWallet = async (userPassword: string): Promise<boolean> => {
    if (!user) {
      setError('User must be authenticated');
      return false;
    }

    if (!userPassword || userPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Get current encrypted wallet
      const { data: currentWallet, error: fetchError } = await supabase
        .from('encrypted_wallet_keys')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError || !currentWallet) {
        throw new Error('Wallet not found');
      }

      if (currentWallet.encryption_method !== 'legacy_userid') {
        console.log('Wallet already using secure encryption');
        return true;
      }

      // Step 2: Decrypt with userId (legacy method)
      const privateKey = await decryptWithUserId(
        user.id,
        currentWallet.encrypted_private_key,
        currentWallet.encryption_iv,
        currentWallet.encryption_salt
      );

      // Step 3: Re-encrypt with user password
      const { encryptedKey, iv, salt } = await encryptWithPassword(
        privateKey,
        userPassword
      );

      // Step 4: Update wallet with new encryption
      const { error: updateError } = await supabase
        .from('encrypted_wallet_keys')
        .update({
          encrypted_private_key: encryptedKey,
          encryption_iv: iv,
          encryption_salt: salt,
          encryption_method: 'password_based',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`Wallet migrated to secure encryption for user ${user.id}`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Migration failed';
      setError(errorMessage);
      console.error('Wallet migration failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    checkNeedsMigration,
    migrateWallet,
    loading,
    error
  };
};

// Helper functions for encryption/decryption
async function decryptWithUserId(
  userId: string,
  encryptedKey: string,
  ivBase64: string,
  saltBase64: string
): Promise<string> {
  const salt = new Uint8Array(
    atob(saltBase64).split('').map(c => c.charCodeAt(0))
  );
  const iv = new Uint8Array(
    atob(ivBase64).split('').map(c => c.charCodeAt(0))
  );

  // Use userId as password (legacy method)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userId),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const encrypted = new Uint8Array(
    atob(encryptedKey).split('').map(c => c.charCodeAt(0))
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

async function encryptWithPassword(
  privateKey: string,
  password: string
): Promise<{ encryptedKey: string; iv: string; salt: string }> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt private key
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    new TextEncoder().encode(privateKey)
  );

  return {
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt))
  };
}
