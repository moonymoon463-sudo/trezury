import { OnchainAddress, Deposit, PaymentMethod } from './types';

export interface WalletProvider {
  generateDepositAddress(userId: string): Promise<OnchainAddress>;
  getDepositAddress(userId: string): Promise<OnchainAddress | null>;
  checkDeposits(address: string): Promise<Deposit[]>;
}

export interface PaymentProvider {
  createPaymentMethod(userId: string, type: 'card' | 'bank_account', data: any): Promise<PaymentMethod>;
  getPaymentMethods(userId: string): Promise<PaymentMethod[]>;
  processPayment(paymentMethodId: string, amount: number): Promise<any>;
}

export interface QuoteProvider {
  getQuote(inputAsset: string, outputAsset: string, amount: number): Promise<any>;
  executeQuote(quoteId: string): Promise<any>;
}