import { supabase } from "@/integrations/supabase/client";
import { OnchainAddress, Deposit } from './providers/types';

export class WalletService {
  async getOrCreateDepositAddress(userId: string): Promise<OnchainAddress> {
    // First check if user already has a deposit address
    const { data: existingAddress, error: fetchError } = await supabase
      .from('onchain_addresses')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingAddress && !fetchError) {
      return existingAddress;
    }

    // Generate a new deposit address (placeholder - would integrate with actual wallet provider)
    const newAddress = this.generatePlaceholderAddress();
    
    // Create addresses for both assets on Ethereum
    const usdcAddress = this.generatePlaceholderAddress();
    const goldAddress = this.generatePlaceholderAddress();
    
    const { data: createdAddresses, error: createError } = await supabase
      .from('onchain_addresses')
      .insert([
        {
          user_id: userId,
          address: usdcAddress,
          chain: 'ethereum',
          asset: 'USDC'
        },
        {
          user_id: userId,
          address: goldAddress,
          chain: 'ethereum',
          asset: 'GOLD'
        }
      ])
      .select();

    if (createError) {
      throw new Error(`Failed to create deposit addresses: ${createError.message}`);
    }

    // Return the USDC address by default (for backwards compatibility)
    const createdAddress = createdAddresses?.find(addr => addr.asset === 'USDC');

    if (!createdAddress) {
      throw new Error('Failed to create USDC deposit address');
    }

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

  private generatePlaceholderAddress(): string {
    // Generate proper Ethereum ERC20 address format (0x + 40 hex characters)
    const chars = '0123456789abcdef';
    let result = '0x';
    for (let i = 0; i < 40; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const walletService = new WalletService();