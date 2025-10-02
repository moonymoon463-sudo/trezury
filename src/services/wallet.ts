import { supabase } from "@/integrations/supabase/client";
import { OnchainAddress, Deposit } from './providers/types';
import { secureWalletService } from './secureWalletService';

/**
 * SECURE WALLET SERVICE
 * 
 * This service manages wallet-related operations that don't require private key access.
 * For wallet creation and private key operations, use secureWalletService directly with user password.
 */
export class WalletService {
  /**
   * Get existing wallet address for the user
   * NOTE: This only returns existing addresses, it does NOT create new ones.
   * To create a wallet, user must use secureWalletService with their password.
   */
  async getExistingAddress(userId: string): Promise<OnchainAddress | null> {
    const { data, error } = await supabase
      .from('onchain_addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('created_with_password', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching wallet address:', error);
      return null;
    }

    return data;
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