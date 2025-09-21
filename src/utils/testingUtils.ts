/**
 * Testing and Validation Utilities for Lending System
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LendingCalculationParams {
  principal: number;
  rate: number;
  termDays: number;
  autocompound?: boolean;
}

export interface APYValidationParams {
  chain: string;
  token: string;
  termDays: number;
  expectedMin?: number;
  expectedMax?: number;
}

export interface HealthFactorParams {
  totalCollateral: number;
  totalDebt: number;
  ltv: number;
  liquidationThreshold: number;
}

export class LendingValidator {
  /**
   * Validate lending calculation accuracy
   */
  static validateLendingCalculation(params: LendingCalculationParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic parameter validation
    if (params.principal <= 0) {
      errors.push("Principal amount must be positive");
    }
    if (params.rate < 0 || params.rate > 1) {
      errors.push("Interest rate must be between 0 and 1");
    }
    if (params.termDays <= 0) {
      errors.push("Term days must be positive");
    }

    // Business logic validation
    if (params.principal > 1000000) {
      warnings.push("Large principal amount detected");
    }
    if (params.rate > 0.5) {
      warnings.push("Unusually high interest rate");
    }
    if (params.termDays < 7) {
      warnings.push("Very short term period");
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate APY calculation results
   */
  static validateAPY(apy: number, params: APYValidationParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic APY validation
    if (apy < 0) {
      errors.push("APY cannot be negative");
    }
    if (apy > 100) {
      errors.push("APY seems unrealistically high (>100%)");
    }

    // Range validation if provided
    if (params.expectedMin !== undefined && apy < params.expectedMin) {
      warnings.push(`APY ${apy}% is below expected minimum ${params.expectedMin}%`);
    }
    if (params.expectedMax !== undefined && apy > params.expectedMax) {
      warnings.push(`APY ${apy}% is above expected maximum ${params.expectedMax}%`);
    }

    // Token-specific validation
    const tokenExpectedRanges: { [key: string]: { min: number; max: number } } = {
      USDC: { min: 0.5, max: 15 },
      USDT: { min: 0.5, max: 15 },
      DAI: { min: 0.5, max: 12 },
      XAUT: { min: 1, max: 8 },
      AURU: { min: 2, max: 25 }
    };

    const expectedRange = tokenExpectedRanges[params.token];
    if (expectedRange) {
      if (apy < expectedRange.min) {
        warnings.push(`${params.token} APY ${apy}% is below typical range (${expectedRange.min}%-${expectedRange.max}%)`);
      }
      if (apy > expectedRange.max) {
        warnings.push(`${params.token} APY ${apy}% is above typical range (${expectedRange.min}%-${expectedRange.max}%)`);
      }
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate health factor calculation
   */
  static validateHealthFactor(healthFactor: number, params: HealthFactorParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic health factor validation
    if (healthFactor < 0) {
      errors.push("Health factor cannot be negative");
    }

    // Calculate expected health factor
    const expectedHealthFactor = params.totalDebt > 0 
      ? (params.totalCollateral * params.liquidationThreshold) / params.totalDebt
      : Infinity;

    const tolerance = 0.01; // 1% tolerance
    const difference = Math.abs(healthFactor - expectedHealthFactor);
    
    if (difference > tolerance && expectedHealthFactor !== Infinity) {
      errors.push(`Health factor calculation mismatch. Expected: ${expectedHealthFactor.toFixed(4)}, Got: ${healthFactor.toFixed(4)}`);
    }

    // Risk level warnings
    if (healthFactor < 1.1) {
      warnings.push("Critical: Health factor below 1.1 - liquidation risk");
    } else if (healthFactor < 1.5) {
      warnings.push("Warning: Health factor below 1.5 - moderate risk");
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate input amounts and constraints
   */
  static validateInputAmount(amount: number, constraints: {
    min?: number;
    max?: number;
    balance?: number;
    decimals?: number;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic amount validation
    if (amount <= 0) {
      errors.push("Amount must be positive");
    }
    if (!Number.isFinite(amount)) {
      errors.push("Amount must be a valid number");
    }

    // Decimal precision check
    if (constraints.decimals !== undefined) {
      const decimalsUsed = amount.toString().split('.')[1]?.length || 0;
      if (decimalsUsed > constraints.decimals) {
        errors.push(`Amount has too many decimal places (max: ${constraints.decimals})`);
      }
    }

    // Min/max constraints
    if (constraints.min !== undefined && amount < constraints.min) {
      errors.push(`Amount ${amount} is below minimum ${constraints.min}`);
    }
    if (constraints.max !== undefined && amount > constraints.max) {
      errors.push(`Amount ${amount} exceeds maximum ${constraints.max}`);
    }

    // Balance check
    if (constraints.balance !== undefined && amount > constraints.balance) {
      errors.push(`Insufficient balance. Required: ${amount}, Available: ${constraints.balance}`);
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Comprehensive lending operation validation
   */
  static validateLendingOperation(operation: {
    type: 'supply' | 'withdraw' | 'borrow' | 'repay';
    asset: string;
    amount: number;
    chain: string;
    userBalance?: number;
    poolLiquidity?: number;
    currentHealthFactor?: number;
    newHealthFactor?: number;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Operation type validation
    const validOperations = ['supply', 'withdraw', 'borrow', 'repay'];
    if (!validOperations.includes(operation.type)) {
      errors.push(`Invalid operation type: ${operation.type}`);
    }

    // Asset validation
    const supportedAssets = ['USDC', 'USDT', 'DAI', 'XAUT', 'AURU'];
    if (!supportedAssets.includes(operation.asset)) {
      warnings.push(`Asset ${operation.asset} may not be fully supported`);
    }

    // Chain validation
    const supportedChains = ['ethereum', 'base', 'arbitrum', 'polygon'];
    if (!supportedChains.includes(operation.chain)) {
      warnings.push(`Chain ${operation.chain} may not be fully supported`);
    }

    // Operation-specific validation
    switch (operation.type) {
      case 'supply':
      case 'repay':
        if (operation.userBalance !== undefined && operation.amount > operation.userBalance) {
          errors.push(`Insufficient balance for ${operation.type}`);
        }
        break;
      
      case 'withdraw':
      case 'borrow':
        if (operation.poolLiquidity !== undefined && operation.amount > operation.poolLiquidity) {
          errors.push(`Insufficient pool liquidity for ${operation.type}`);
        }
        break;
    }

    // Health factor validation for risky operations
    if ((operation.type === 'borrow' || operation.type === 'withdraw') && operation.newHealthFactor !== undefined) {
      if (operation.newHealthFactor < 1.1) {
        errors.push("Operation would result in unsafe health factor");
      } else if (operation.newHealthFactor < 1.5) {
        warnings.push("Operation results in moderate liquidation risk");
      }
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }
}

export class ErrorHandler {
  /**
   * Handle and categorize lending errors
   */
  static handleLendingError(error: unknown): {
    category: 'network' | 'validation' | 'business' | 'unknown';
    message: string;
    userMessage: string;
    retryable: boolean;
  } {
    let category: 'network' | 'validation' | 'business' | 'unknown' = 'unknown';
    let message = 'Unknown error occurred';
    let userMessage = 'Something went wrong. Please try again.';
    let retryable = false;

    if (error instanceof Error) {
      message = error.message;

      // Network errors
      if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
        category = 'network';
        userMessage = 'Network error. Please check your connection and try again.';
        retryable = true;
      }
      // Validation errors
      else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
        category = 'validation';
        userMessage = 'Invalid input. Please check your values and try again.';
        retryable = false;
      }
      // Business logic errors
      else if (message.includes('insufficient') || message.includes('balance') || message.includes('liquidity')) {
        category = 'business';
        userMessage = 'Transaction cannot be completed due to insufficient funds or liquidity.';
        retryable = false;
      }
      // Health factor errors
      else if (message.includes('health factor') || message.includes('liquidation')) {
        category = 'business';
        userMessage = 'Transaction would put your account at risk of liquidation.';
        retryable = false;
      }
    }

    return { category, message, userMessage, retryable };
  }

  /**
   * Format error for user display
   */
  static formatUserError(error: unknown): string {
    const { userMessage } = this.handleLendingError(error);
    return userMessage;
  }
}

export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  /**
   * Track operation performance
   */
  static trackOperation(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
    
    // Keep only last 100 measurements
    const values = this.metrics.get(operation)!;
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Get performance statistics
   */
  static getStats(operation: string): {
    average: number;
    min: number;
    max: number;
    count: number;
  } | null {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return null;

    return {
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  /**
   * Check if operation is performing poorly
   */
  static isSlowOperation(operation: string, threshold: number = 5000): boolean {
    const stats = this.getStats(operation);
    return stats ? stats.average > threshold : false;
  }
}
