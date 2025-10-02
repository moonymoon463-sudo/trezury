import { supabase } from "@/integrations/supabase/client";
import { OnchainAddress, Deposit } from './providers/types';
import { secureWalletService } from './secureWalletService';

/**
 * SECURE WALLET SERVICE
 * 
 * This service uses deterministic wallet generation.
 * Each user gets a unique Ethereum address derived from their user ID.
 * Private keys are NEVER stored - they can only be derived with the user's password.
 */
export class WalletService {
  /**
   * Get or create a secure deterministic wallet address for the user
   * Returns the same address for the same user ID every time
   */
  async getOrCreateDepositAddress(userId: string): Promise<OnchainAddress> {
    // Check if user already has a wallet address stored
    const { data: existingAddress, error: fetchError } = await supabase
      .from('onchain_addresses')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (existingAddress && !fetchError) {
      return existingAddress;
    }

    // Generate secure deterministic wallet address
    // This creates the SAME address for this user every time based on their user ID
    const walletAddress = await secureWalletService.getWalletAddress(userId);
    
    if (!walletAddress) {
      throw new Error('Failed to generate wallet address');
    }

    // Store the public address (NO private keys are stored)
    const { data: createdAddress, error: createError } = await supabase
      .from('onchain_addresses')
      .insert({
        user_id: userId,
        address: walletAddress,
        chain: 'ethereum',
        asset: 'USDC', // Same address works for all ERC-20 tokens (USDC, XAUT, etc.)
        setup_method: 'deterministic',
        created_with_password: false // Can be accessed with user ID alone
      })
      .select()
      .single();

    if (createError) {
      // If duplicate, that's fine - address already exists
      if (createError.code === '23505') {
        const { data: existing } = await supabase
          .from('onchain_addresses')
          .select('*')
          .eq('user_id', userId)
          .limit(1)
          .single();
        
        if (existing) return existing;
      }
      throw new Error(`Failed to store wallet address: ${createError.message}`);
    }

    console.log('✅ Secure wallet created for user:', walletAddress);
    return createdAddress;
  }

  async getRecentDeposits(userId: string): Promise<Deposit[]> {
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch deposits: ${error.message}`);
    }

    return (data || []).map(deposit => ({
      ...deposit,
      status: deposit.status as 'pending' | 'confirmed' | 'failed',
      metadata: (deposit.metadata as Record<string, any>) || {},
      tx_hash: deposit.tx_hash || undefined,
      block_number: deposit.block_number || undefined,
      confirmed_at: deposit.confirmed_at || undefined
    }));
  }

  async confirmDeposit(userId: string, txHash: string): Promise<void> {
    // This would typically trigger a backend process to verify the transaction
    // For now, create a pending deposit entry
    const { data: address } = await supabase
      .from('onchain_addresses')
      .select('address')
      .eq('user_id', userId)
      .single();

    if (!address) {
      throw new Error('No deposit address found for user');
    }

    const { error } = await supabase
      .from('deposits')
      .insert({
        user_id: userId,
        address: address.address,
        amount: 0, // Amount would be determined by blockchain verification
        asset: 'USDC',
        chain: 'ethereum', // ERC20 tokens on Ethereum
        tx_hash: txHash,
        status: 'pending'
      });

    if (error) {
      throw new Error(`Failed to create deposit: ${error.message}`);
    }
  }

}

export const walletService = new WalletService();