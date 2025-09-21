import { supabase } from "@/integrations/supabase/client";

export interface SecurityEvent {
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: any) => string;
}

class SecurityService {
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  /**
   * Rate limiting for client-side operations
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Clean up expired entries
    this.cleanupExpiredEntries(windowStart);
    
    const entry = this.rateLimitStore.get(key) || { count: 0, resetTime: now + config.windowMs };
    
    // Reset if window has passed
    if (now >= entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + config.windowMs;
    }
    
    const allowed = entry.count < config.maxRequests;
    
    if (allowed) {
      entry.count++;
      this.rateLimitStore.set(key, entry);
    }
    
    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  /**
   * Log security events
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Log to browser console for development
      console.warn('🚨 Security Event:', event);
      
      // Store in Supabase for production monitoring
      const { error } = await supabase.functions.invoke('security-monitor', {
        body: {
          action: 'log_event',
          event: {
            ...event,
            timestamp: new Date().toISOString(),
            session_id: this.generateSessionId()
          }
        }
      });

      if (error) {
        console.error('Failed to log security event:', error);
      }
    } catch (error) {
      console.error('Security logging error:', error);
    }
  }

  /**
   * Validate transaction parameters for security
   */
  validateTransactionSecurity(params: {
    amount: number;
    asset: string;
    recipient?: string;
    slippage?: number;
  }): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Amount validation
    if (params.amount <= 0) {
      errors.push('Transaction amount must be positive');
    }

    if (params.amount > 1000000) {
      warnings.push('Large transaction amount detected');
    }

    // Slippage validation
    if (params.slippage && params.slippage > 5) {
      warnings.push('High slippage tolerance may result in poor execution');
    }

    if (params.slippage && params.slippage > 10) {
      errors.push('Slippage tolerance too high (>10%)');
    }

    // Asset validation
    const allowedAssets = ['USDC', 'XAUT', 'ETH', 'WETH'];
    if (!allowedAssets.includes(params.asset)) {
      errors.push(`Asset ${params.asset} not supported`);
    }

    // Recipient validation (if provided)
    if (params.recipient) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(params.recipient)) {
        errors.push('Invalid recipient address format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Enhanced input validation with sanitization
   */
  validateAndSanitizeInput(input: string, type: 'address' | 'amount' | 'email' | 'text'): {
    isValid: boolean;
    sanitized: string;
    errors: string[];
  } {
    const errors: string[] = [];
    let sanitized = input.trim();

    switch (type) {
      case 'address':
        // Ethereum address validation
        if (!/^0x[a-fA-F0-9]{40}$/.test(sanitized)) {
          errors.push('Invalid Ethereum address format');
        }
        break;

      case 'amount':
        // Numeric validation
        const numValue = parseFloat(sanitized);
        if (isNaN(numValue) || numValue < 0) {
          errors.push('Invalid amount format');
        }
        if (numValue > Number.MAX_SAFE_INTEGER) {
          errors.push('Amount too large');
        }
        break;

      case 'email':
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitized)) {
          errors.push('Invalid email format');
        }
        break;

      case 'text':
        // Basic text sanitization
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/[<>]/g, '');
        if (sanitized.length > 1000) {
          errors.push('Text too long (max 1000 characters)');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors
    };
  }

  /**
   * Monitor for suspicious patterns
   */
  async detectSuspiciousActivity(userId: string, action: string): Promise<{
    isSuspicious: boolean;
    riskScore: number;
    reasons: string[];
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('security-monitor', {
        body: {
          action: 'analyze_activity',
          userId,
          activity: action,
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error('Suspicious activity detection failed:', error);
        return { isSuspicious: false, riskScore: 0, reasons: [] };
      }

      return data || { isSuspicious: false, riskScore: 0, reasons: [] };
    } catch (error) {
      console.error('Activity monitoring error:', error);
      return { isSuspicious: false, riskScore: 0, reasons: [] };
    }
  }

  /**
   * Generate secure session identifier
   */
  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpiredEntries(windowStart: number): void {
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (entry.resetTime < windowStart) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Check if user action requires additional verification
   */
  async requiresAdditionalVerification(userId: string, action: string, amount?: number): Promise<{
    required: boolean;
    reason: string;
    verificationType: 'email' | 'sms' | 'totp' | 'manual_review';
  }> {
    // High-value transactions
    if (amount && amount > 10000) {
      return {
        required: true,
        reason: 'High-value transaction requires additional verification',
        verificationType: 'manual_review'
      };
    }

    // Sensitive operations
    const sensitiveActions = ['withdraw', 'change_email', 'add_payment_method'];
    if (sensitiveActions.includes(action)) {
      return {
        required: true,
        reason: 'Sensitive operation requires verification',
        verificationType: 'email'
      };
    }

    return {
      required: false,
      reason: '',
      verificationType: 'email'
    };
  }

  /**
   * Generate CSRF token for forms
   */
  generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string, expectedToken: string): boolean {
    return token === expectedToken && token.length === 64;
  }
}

export const securityService = new SecurityService();