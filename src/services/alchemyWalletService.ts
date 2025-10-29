import { supabase } from '@/integrations/supabase/client';
import { ethers } from 'ethers';

/**
 * Service for managing Alchemy Account Kit smart wallets
 * Handles storing and retrieving Alchemy wallet addresses
 */
class AlchemyWalletService {
  /**
   * Store Alchemy wallet address in user's profile
   */
  async storeAlchemyAddress(userId: string, address: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ alchemy_address: address })
      .eq('id', userId);

    if (error) {
      console.error('Error storing Alchemy address:', error);
      throw new Error('Failed to store Alchemy wallet address');
    }

    console.log(`Alchemy address ${address} stored for user ${userId}`);
  }

  /**
   * Get stored Alchemy wallet address for a user
   */
  async getAlchemyAddress(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('alchemy_address')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching Alchemy address:', error);
      return null;
    }

    return data?.alchemy_address || null;
  }

  /**
   * Check if user has an Alchemy wallet setup
   */
  async hasAlchemyWallet(userId: string): Promise<boolean> {
    const address = await this.getAlchemyAddress(userId);
    return address !== null && ethers.isAddress(address);
  }

  /**
   * Get Alchemy signer from the current Account Kit session
   * Note: This requires the Alchemy Account Kit to be initialized and connected
   */
  async getSigner(): Promise<ethers.Signer | null> {
    try {
      // Get the EIP-1193 provider from Alchemy Account Kit
      // This is exposed via the window.ethereum object when using Alchemy
      if (!window.ethereum) {
        console.error('No Ethereum provider found');
        return null;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      return signer;
    } catch (error) {
      console.error('Error getting Alchemy signer:', error);
      return null;
    }
  }

  /**
   * Verify that an address is a valid Ethereum address
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }
}

export const alchemyWalletService = new AlchemyWalletService();
