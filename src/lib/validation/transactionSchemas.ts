import { z } from 'zod';

// Ethereum address validation
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

// Base transaction schema
export const baseTransactionSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .min(0.01, 'Minimum amount is $0.01')
    .max(1000000, 'Maximum amount is $1,000,000')
    .finite('Amount must be a valid number'),
  currency: z.enum(['USDC', 'XAUT', 'TRZRY', 'USD'], {
    errorMap: () => ({ message: 'Invalid currency' }),
  }),
});

// Send transaction schema
export const sendTransactionSchema = baseTransactionSchema.extend({
  recipientAddress: z
    .string()
    .trim()
    .regex(ethereumAddressRegex, 'Invalid Ethereum address')
    .refine((addr) => addr !== '0x0000000000000000000000000000000000000000', {
      message: 'Cannot send to zero address',
    }),
  asset: z.enum(['USDC', 'XAUT', 'TRZRY'], {
    errorMap: () => ({ message: 'Invalid asset type' }),
  }),
});

// Buy gold schema
export const buyGoldSchema = z.object({
  amountUSD: z
    .number()
    .positive('Amount must be positive')
    .min(10, 'Minimum purchase is $10')
    .max(100000, 'Maximum single purchase is $100,000')
    .finite('Amount must be a valid number'),
  paymentMethod: z.enum(['wallet', 'moonpay', 'card'], {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
});

// Sell gold schema
export const sellGoldSchema = z.object({
  grams: z
    .number()
    .positive('Amount must be positive')
    .min(0.01, 'Minimum sale is 0.01 grams')
    .max(1000, 'Maximum single sale is 1000 grams')
    .finite('Amount must be a valid number'),
  payoutMethod: z.enum(['wallet', 'bank'], {
    errorMap: () => ({ message: 'Invalid payout method' }),
  }),
  bankDetails: z
    .object({
      accountNumber: z
        .string()
        .trim()
        .min(4, 'Account number too short')
        .max(34, 'Account number too long')
        .regex(/^[0-9]+$/, 'Account number must contain only digits'),
      routingNumber: z
        .string()
        .trim()
        .length(9, 'Routing number must be 9 digits')
        .regex(/^[0-9]{9}$/, 'Invalid routing number'),
      accountHolderName: z
        .string()
        .trim()
        .min(2, 'Name too short')
        .max(100, 'Name too long')
        .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
    })
    .optional(),
});

// Swap transaction schema
export const swapTransactionSchema = z.object({
  inputAsset: z.enum(['USDC', 'XAUT', 'TRZRY'], {
    errorMap: () => ({ message: 'Invalid input asset' }),
  }),
  outputAsset: z.enum(['USDC', 'XAUT', 'TRZRY'], {
    errorMap: () => ({ message: 'Invalid output asset' }),
  }),
  inputAmount: z
    .number()
    .positive('Amount must be positive')
    .min(0.01, 'Minimum swap is $0.01')
    .max(100000, 'Maximum single swap is $100,000')
    .finite('Amount must be a valid number'),
  slippageTolerance: z
    .number()
    .min(0.1, 'Minimum slippage is 0.1%')
    .max(10, 'Maximum slippage is 10%')
    .default(0.5),
}).refine((data) => data.inputAsset !== data.outputAsset, {
  message: 'Input and output assets must be different',
  path: ['outputAsset'],
});

// MoonPay transaction schema
export const moonPayTransactionSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .min(10, 'Minimum purchase is $10')
    .max(10000, 'Maximum purchase is $10,000')
    .finite('Amount must be a valid number'),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, 'Currency code must be 3 characters')
    .regex(/^[A-Z]{3}$/, 'Invalid currency code'),
  walletAddress: z
    .string()
    .trim()
    .regex(ethereumAddressRegex, 'Invalid wallet address'),
  returnUrl: z
    .string()
    .url('Invalid return URL')
    .startsWith('https://', 'Return URL must use HTTPS')
    .optional(),
});

// Portfolio rebalance schema
export const portfolioRebalanceSchema = z.object({
  allocations: z
    .array(
      z.object({
        asset: z.enum(['USDC', 'XAUT', 'TRZRY'], {
          errorMap: () => ({ message: 'Invalid asset' }),
        }),
        targetPercentage: z
          .number()
          .min(0, 'Percentage cannot be negative')
          .max(100, 'Percentage cannot exceed 100'),
      })
    )
    .min(1, 'At least one allocation required')
    .refine(
      (allocations) => {
        const total = allocations.reduce((sum, a) => sum + a.targetPercentage, 0);
        return Math.abs(total - 100) < 0.01; // Allow for floating point precision
      },
      {
        message: 'Total allocation must equal 100%',
      }
    ),
});

// KYC verification schema
export const kycVerificationSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters'),
  dateOfBirth: z
    .string()
    .refine(
      (date) => {
        const dob = new Date(date);
        const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 18 && age <= 120;
      },
      { message: 'Must be at least 18 years old' }
    ),
  ssnLastFour: z
    .string()
    .trim()
    .length(4, 'Must be last 4 digits of SSN')
    .regex(/^[0-9]{4}$/, 'Must be 4 digits'),
  address: z
    .string()
    .trim()
    .min(5, 'Address too short')
    .max(200, 'Address too long'),
  city: z
    .string()
    .trim()
    .min(2, 'City name too short')
    .max(100, 'City name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'City name contains invalid characters'),
  state: z
    .string()
    .trim()
    .length(2, 'State must be 2-letter code')
    .regex(/^[A-Z]{2}$/, 'Invalid state code'),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?1?\d{10}$/, 'Invalid phone number format'),
});

// Generic amount validation helper
export const validateAmount = (
  amount: number,
  min: number = 0.01,
  max: number = 1000000
): { valid: boolean; error?: string } => {
  if (typeof amount !== 'number' || !isFinite(amount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }
  if (amount < min) {
    return { valid: false, error: `Amount must be at least $${min}` };
  }
  if (amount > max) {
    return { valid: false, error: `Amount cannot exceed $${max}` };
  }
  return { valid: true };
};

// Sanitize text input helper
export const sanitizeTextInput = (input: string, maxLength: number = 1000): string => {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

// Validate Ethereum address
export const isValidEthereumAddress = (address: string): boolean => {
  return ethereumAddressRegex.test(address) && address !== '0x0000000000000000000000000000000000000000';
};
