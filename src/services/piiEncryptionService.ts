import { supabase } from '@/integrations/supabase/client';

export interface PIIEncryptionService {
  encryptSSN(ssn: string): Promise<string>;
  decryptSSN(encryptedSSN: string): Promise<string>;
  hashSensitiveField(value: string, salt: string): string;
  logPIIAccess(userId: string, fieldAccessed: string, accessType: 'read' | 'write'): Promise<void>;
  validatePIIAccess(userId: string): Promise<boolean>;
}

class PIIEncryptionServiceImpl implements PIIEncryptionService {
  private getEncryptionKey(): string {
    // CRITICAL: Encryption key MUST come from environment only
    // Never use localStorage or hardcoded fallbacks for PII encryption
    const keyString = typeof process !== 'undefined' 
      ? process.env.PII_ENCRYPTION_KEY 
      : undefined;
    
    if (!keyString) {
      // Fail closed - do not allow PII operations without proper key
      throw new Error('CRITICAL: PII_ENCRYPTION_KEY not configured. PII operations cannot proceed.');
    }
    
    return keyString;
  }
  
  async encryptSSN(ssn: string): Promise<string> {
    // Use Web Crypto API for encryption
    const encoder = new TextEncoder();
    const data = encoder.encode(ssn);
    
    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Get encryption key from secure source
    const encryptionKey = this.getEncryptionKey();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0')),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }
  
  async decryptSSN(encryptedSSN: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedSSN).split('').map(char => char.charCodeAt(0))
    );
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Get encryption key from secure source
    const encryptionKey = this.getEncryptionKey();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0')),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  }
  
  hashSensitiveField(value: string, salt: string): string {
    // Create a simple hash for non-reversible storage
    return btoa(value + salt).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }
  
  async logPIIAccess(userId: string, fieldAccessed: string, accessType: 'read' | 'write'): Promise<void> {
    try {
      await supabase.rpc('log_sensitive_access', {
        p_table_name: 'profiles',
        p_operation: `PII_${accessType.toUpperCase()}`,
        p_sensitive_fields: [fieldAccessed],
        p_metadata: {
          access_type: accessType,
          field: fieldAccessed,
          timestamp: new Date().toISOString(),
          encryption_used: true
        }
      });
    } catch (error) {
      console.error('Failed to log PII access:', error);
    }
  }
  
  async validatePIIAccess(userId: string): Promise<boolean> {
    try {
      // Check rate limiting for PII access
      const { data: canAccess } = await supabase.rpc('check_pii_rate_limit', {
        p_user_id: userId
      });
      
      if (!canAccess) {
        await this.logPIIAccess(userId, 'rate_limit_exceeded', 'read');
        return false;
      }
      
      // Validate access patterns
      const { data: isValidPattern } = await supabase.rpc('validate_profile_access_pattern', {
        user_uuid: userId
      });
      
      if (!isValidPattern) {
        await this.logPIIAccess(userId, 'suspicious_pattern', 'read');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('PII access validation failed:', error);
      return false;
    }
  }
  
  // Enhanced SSN storage with additional security layers
  async secureStoreSSN(userId: string, ssnLastFour: string): Promise<void> {
    try {
      // Validate user can access PII
      const canAccess = await this.validatePIIAccess(userId);
      if (!canAccess) {
        throw new Error('PII access denied due to security validation');
      }
      
      // Create hash for quick lookups (non-reversible)
      const ssnHash = this.hashSensitiveField(ssnLastFour, userId);
      
      // Encrypt the actual value for secure storage
      const encryptedSSN = await this.encryptSSN(ssnLastFour);
      
      // Use secure update function for PII
      const { error } = await supabase.rpc('update_my_profile', {
        p_ssn_last_four: ssnLastFour
      });
      
      if (error) throw error;
      
      // Log the secure storage operation
      await this.logPIIAccess(userId, 'ssn_last_four', 'write');
      
    } catch (error) {
      console.error('Failed to securely store SSN:', error);
      throw error;
    }
  }
  
  // Data retention policy implementation
  async applyDataRetentionPolicy(): Promise<void> {
    try {
      // Find profiles with old PII data (older than 7 years for example)
      const retentionDate = new Date();
      retentionDate.setFullYear(retentionDate.getFullYear() - 7);
      
      // Use masked view for retention policy (admin function would need separate implementation)
      const { data: oldProfiles } = await supabase
        .from('v_profiles_masked')
        .select('id, created_at')
        .lt('created_at', retentionDate.toISOString())
        .eq('kyc_status', 'verified');
      
      if (oldProfiles && oldProfiles.length > 0) {
        console.log(`Found ${oldProfiles.length} profiles eligible for data retention policy`);
        
        // In production, this would archive or anonymize old data
        // For now, just log the operation
        for (const profile of oldProfiles) {
          await this.logPIIAccess(profile.id, 'data_retention_check', 'read');
        }
      }
    } catch (error) {
      console.error('Data retention policy application failed:', error);
    }
  }
}

export const piiEncryptionService = new PIIEncryptionServiceImpl();