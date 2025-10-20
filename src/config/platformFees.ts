/**
 * Platform Fee Configuration
 * 
 * CRITICAL: swapFeeRecipient MUST be an EOA (Externally Owned Account)
 * NEVER use a smart contract address (like Settler) as the fee recipient
 * 
 * User confirmed: 0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835 is an EOA
 */

export const PLATFORM_FEE_CONFIG = {
  // Platform fee recipient wallet (EOA - User Confirmed)
  RECIPIENT_ADDRESS: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
  
  // Fee percentage in basis points (80 = 0.8%)
  FEE_BPS: 80,
  
  /**
   * Fee token strategy
   * - 'buy': Collect fee in output token (default)
   * - 'sell': Collect fee in input token
   */
  FEE_TOKEN_STRATEGY: 'buy' as 'buy' | 'sell',
  
  // Validate the address is properly formatted
  isValidAddress(): boolean {
    const addr = this.RECIPIENT_ADDRESS;
    return addr.startsWith('0x') && addr.length === 42;
  }
} as const;

// Export for convenience
export const PLATFORM_FEE_RECIPIENT = PLATFORM_FEE_CONFIG.RECIPIENT_ADDRESS;
export const PLATFORM_FEE_BPS = PLATFORM_FEE_CONFIG.FEE_BPS;
export const PLATFORM_FEE_TOKEN_STRATEGY = PLATFORM_FEE_CONFIG.FEE_TOKEN_STRATEGY;
