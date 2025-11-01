/**
 * Solana Wallet Service
 * Secure Solana keypair generation, encryption, and management
 * Mirrors the Ethereum wallet service architecture
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { supabase } from '@/integrations/supabase/client';

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 32;

/**
 * Generate or retrieve user salt for key derivation
 */
async function getOrCreateSalt(userId: string): Promise<Uint8Array> {
  const { data, error } = await supabase
    .rpc('get_user_salt', { p_user_id: userId });

  if (data) {
    return bs58.decode(data);
  }

  // Generate new salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  
  const { error: insertError } = await supabase.rpc('set_user_salt', {
    p_user_id: userId,
    p_salt: bs58.encode(salt),
  });

  if (insertError) {
    console.error('[SolanaWallet] Failed to save salt:', insertError);
    throw new Error('Failed to initialize wallet security');
  }

  return salt;
}

/**
 * Derive Solana keypair from user credentials
 */
async function deriveKeypair(
  userId: string,
  userPassword: string
): Promise<Keypair> {
  if (!userPassword || userPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const salt = await getOrCreateSalt(userId);
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(userPassword + userId);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes for Solana secret key
  );

  const secretKey = new Uint8Array(derivedBits);
  return Keypair.fromSeed(secretKey);
}

/**
 * Encrypt and store Solana keypair in database
 */
async function encryptAndStoreKeypair(
  userId: string,
  password: string,
  keypair: Keypair
): Promise<void> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // Derive encryption key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the secret key
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer },
    encryptionKey,
    keypair.secretKey
  );

  // Store encrypted keypair
  const { error } = await supabase.rpc('upsert_solana_wallet', {
    p_user_id: userId,
    p_encrypted_key: bs58.encode(new Uint8Array(encryptedData)),
    p_public_key: keypair.publicKey.toBase58(),
    p_salt: bs58.encode(salt),
    p_iv: bs58.encode(iv),
  });

  if (error) {
    console.error('[SolanaWallet] Failed to store encrypted keypair:', error);
    throw new Error('Failed to save wallet');
  }
}

/**
 * Decrypt stored Solana keypair
 */
async function decryptKeypair(
  userId: string,
  password: string
): Promise<Keypair> {
  const { data, error } = await supabase.rpc('get_solana_wallet', {
    p_user_id: userId,
  });

  if (error || !data) {
    throw new Error('Wallet not found');
  }

  const walletData = data as any;

  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = bs58.decode(walletData.encryption_salt);
  const iv = bs58.decode(walletData.encryption_iv);

  const decryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const encryptedData = bs58.decode(walletData.encrypted_private_key);

  try {
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer },
      decryptionKey,
      encryptedData
    );

    return Keypair.fromSecretKey(new Uint8Array(decryptedData));
  } catch (err) {
    throw new Error('Invalid password or corrupted wallet data');
  }
}

/**
 * Get or create Solana wallet for user
 */
export async function getSolanaKeypair(
  userId: string,
  password: string
): Promise<Keypair> {
  try {
    // Try to decrypt existing wallet
    return await decryptKeypair(userId, password);
  } catch (err) {
    // Generate new keypair if none exists
    console.log('[SolanaWallet] Generating new keypair for user');
    const keypair = await deriveKeypair(userId, password);
    await encryptAndStoreKeypair(userId, password, keypair);
    return keypair;
  }
}

/**
 * Get Solana public key for user
 */
export async function getSolanaPublicKey(userId: string): Promise<string | null> {
  const { data } = await supabase.rpc('get_solana_public_key', {
    p_user_id: userId,
  });

  return data as string | null;
}

/**
 * Export keypair as base58 string (for signing)
 */
export function exportKeypairBase58(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

/**
 * Sign message with Solana keypair
 */
export function signMessage(keypair: Keypair, message: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, keypair.secretKey);
}

export const solanaWalletService = {
  getSolanaKeypair,
  getSolanaPublicKey,
  exportKeypairBase58,
  signMessage,
};
