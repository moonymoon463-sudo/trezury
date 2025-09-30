import { supabase } from '@/integrations/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

interface RetryConfig {
  maxAttempts?: number;
  delays?: number[];
  shouldRetry?: (error: PostgrestError | Error) => boolean;
}

const defaultConfig: Required<RetryConfig> = {
  maxAttempts: 3,
  delays: [1000, 2000, 4000], // Exponential backoff: 1s, 2s, 4s
  shouldRetry: (error) => {
    // Don't retry on auth errors or forbidden
    if ('code' in error) {
      const postgrestError = error as PostgrestError;
      if (postgrestError.code === 'PGRST301' || postgrestError.code === 'PGRST302') {
        return false; // Auth errors
      }
    }
    
    // Don't retry on 401/403
    if (error.message.includes('401') || error.message.includes('403')) {
      return false;
    }
    
    // Retry on network errors and other failures
    return true;
  },
};

/**
 * Wrapper function to execute Supabase queries with automatic retry logic
 */
export async function withRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  config: RetryConfig = {}
): Promise<{ data: T | null; error: PostgrestError | null; attempts: number }> {
  const { maxAttempts, delays, shouldRetry } = { ...defaultConfig, ...config };
  
  let lastError: PostgrestError | null = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      console.log(`[Retry Wrapper] Attempt ${attempts}/${maxAttempts}`);
      const result = await queryFn();
      
      if (result.error) {
        lastError = result.error;
        
        // Check if we should retry this error
        if (!shouldRetry(result.error)) {
          console.log('[Retry Wrapper] Error not retryable:', result.error.message);
          return { ...result, attempts };
        }
        
        // If we have more attempts left, wait and retry
        if (attempts < maxAttempts) {
          const delay = delays[attempts - 1] || delays[delays.length - 1];
          console.log(`[Retry Wrapper] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // Success!
        if (attempts > 1) {
          console.log(`[Retry Wrapper] Success after ${attempts} attempts`);
        }
        return { ...result, attempts };
      }
    } catch (err) {
      console.error('[Retry Wrapper] Unexpected error:', err);
      lastError = {
        name: 'RetryError',
        message: err instanceof Error ? err.message : 'Unknown error',
        details: '',
        hint: '',
        code: 'UNKNOWN',
      };
      
      if (attempts < maxAttempts) {
        const delay = delays[attempts - 1] || delays[delays.length - 1];
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  console.error('[Retry Wrapper] All attempts failed:', lastError);
  return { data: null, error: lastError, attempts };
}

/**
 * Helper to check current session validity before executing queries
 */
export async function ensureValidSession(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.error('[Session Check] Invalid session:', error?.message);
      return false;
    }
    
    const expiresAt = new Date(session.expires_at! * 1000);
    const minutesUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 60000);
    
    if (minutesUntilExpiry <= 0) {
      console.log('[Session Check] Session expired, attempting refresh...');
      const { error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('[Session Check] Refresh failed:', refreshError.message);
        return false;
      }
      
      console.log('[Session Check] Session refreshed successfully');
      return true;
    }
    
    return true;
  } catch (err) {
    console.error('[Session Check] Unexpected error:', err);
    return false;
  }
}

/**
 * Execute a query with session validation and retry logic
 */
export async function executeWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  config: RetryConfig = {}
): Promise<{ data: T | null; error: PostgrestError | null; attempts: number }> {
  // First, ensure we have a valid session
  const sessionValid = await ensureValidSession();
  
  if (!sessionValid) {
    return {
      data: null,
      error: {
        name: 'SessionError',
        message: 'Invalid or expired session',
        details: 'Please log in again',
        hint: '',
        code: 'SESSION_INVALID',
      },
      attempts: 0,
    };
  }
  
  // Execute with retry logic
  return withRetry(queryFn, config);
}
