/**
 * Encryption utilities for secure wallet operations
 */

/**
 * Decrypt private key using password and PBKDF2 key derivation
 * Supports both legacy format (iv:salt:encrypted) and new database format (separate fields)
 */
export async function decryptPrivateKey(
  encryptedKeyOrBase64: string, 
  password: string,
  ivBase64?: string,
  saltBase64?: string
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    let iv: Uint8Array;
    let salt: Uint8Array;
    let encrypted: Uint8Array;
    
    // New format: separate base64-encoded fields
    if (ivBase64 && saltBase64) {
      console.log('[Encryption] Using new format with separate IV and salt');
      iv = base64ToUint8Array(ivBase64);
      salt = base64ToUint8Array(saltBase64);
      encrypted = base64ToUint8Array(encryptedKeyOrBase64);
    } else {
      // Legacy format: iv:salt:encrypted hex string
      console.log('[Encryption] Using legacy format');
      const parts = encryptedKeyOrBase64.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted key format');
      }
      
      const [ivHex, saltHex, encryptedHex] = parts;
      iv = hexToUint8Array(ivHex);
      salt = hexToUint8Array(saltHex);
      encrypted = hexToUint8Array(encryptedHex);
    }
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
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
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error);
    throw new Error('Failed to decrypt wallet. Please verify your password is correct.');
  }
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
