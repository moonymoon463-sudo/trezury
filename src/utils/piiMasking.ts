/**
 * PII Masking Utilities
 * 
 * Provides functions to mask sensitive Personally Identifiable Information (PII)
 * in the UI to prevent shoulder surfing and unauthorized viewing.
 * 
 * Security Note: This is UI-level masking only. Backend RLS policies and audit
 * logging still apply for all PII access.
 */

/**
 * Masks a person's name by showing only the first and last character
 * @param name - The full name to mask
 * @returns Masked name (e.g., "John Doe" -> "J***n D*e")
 */
export const maskName = (name: string | null): string => {
  if (!name) return 'N/A';
  
  const trimmedName = name.trim();
  if (trimmedName.length === 0) return 'N/A';
  if (trimmedName.length <= 2) return '***';
  
  return trimmedName[0] + '***' + trimmedName[trimmedName.length - 1];
};

/**
 * Masks a full name (first + last) by masking each part separately
 * @param firstName - First name
 * @param lastName - Last name
 * @returns Masked full name (e.g., "John Doe" -> "J***n D*e")
 */
export const maskFullName = (firstName: string | null, lastName: string | null): string => {
  if (!firstName && !lastName) return 'N/A';
  
  const maskedFirst = firstName ? maskName(firstName) : '';
  const maskedLast = lastName ? maskName(lastName) : '';
  
  return `${maskedFirst} ${maskedLast}`.trim() || 'N/A';
};

/**
 * Masks an email address
 * @param email - The email to mask
 * @returns Masked email (e.g., "john@example.com" -> "j***n@example.com")
 */
export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  
  const [local, domain] = email.split('@');
  if (local.length <= 2) return '***@' + domain;
  
  return local[0] + '***' + local[local.length - 1] + '@' + domain;
};

/**
 * Masks a phone number
 * @param phone - The phone number to mask
 * @returns Masked phone (e.g., "+1234567890" -> "***7890")
 */
export const maskPhone = (phone: string | null): string => {
  if (!phone) return 'N/A';
  
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  
  return '***-***-' + digits.slice(-4);
};

/**
 * Masks a Social Security Number
 * @param ssn - The SSN to mask (can be full or last 4 digits)
 * @returns Masked SSN (e.g., "123456789" -> "***-**-6789")
 */
export const maskSSN = (ssn: string | null): string => {
  if (!ssn) return 'N/A';
  
  const digits = ssn.replace(/\D/g, '');
  if (digits.length <= 4) return '***-**-' + digits;
  
  return '***-**-' + digits.slice(-4);
};

/**
 * Masks a street address by showing only the street number
 * @param address - The full address
 * @returns Masked address (e.g., "123 Main St" -> "123 *** [PROTECTED]")
 */
export const maskAddress = (address: string | null): string => {
  if (!address) return 'N/A';
  
  const parts = address.trim().split(' ');
  if (parts.length === 0) return 'N/A';
  
  return parts[0] + ' *** [PROTECTED]';
};
