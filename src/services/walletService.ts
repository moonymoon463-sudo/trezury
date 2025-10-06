import { supabase } from "@/integrations/supabase/client";
import { ethers } from "ethers";
import { secureWalletService } from "./secureWalletService";

/**
 * REAL BLOCKCHAIN WALLET SERVICE
 * Connects to Ethereum mainnet for XAUT/USDC tokens using user-specific wallets
 */

export interface WalletBalance {
  asset: string;
  amount: number;
  chain: string;
}

export interface WalletInfo {
  address: string;
  balances: WalletBalance[];
}

class WalletService {
  private readonly ETHEREUM_RPC = "https://eth-mainnet.g.alchemy.com/v2/demo";
  private readonly USDC_CONTRACT = "0xA0b86a33E6441b7C88047F0fE3BDD78Db8DC820b"; // USDC on Ethereum
  private readonly XAUT_CONTRACT = "0x68749665FF8D2d112Fa859AA293F07A622782F38"; // XAUT on Ethereum

  /**
   * Get wallet for user - shows REAL blockchain balances for their unique wallet
   */
  async getWallet(userId: string): Promise<WalletInfo> {
    try {
      // Get user's unique wallet address (read-only, no auto-creation)
      const address = await secureWalletService.getWalletAddress(userId);
      if (!address) {
        throw new Error('No wallet address found for user');
      }
      
      // Get real blockchain balances
      const balances = await this.getWalletBalances(address);
      
      console.log('✅ User wallet loaded:', { address, balances });
      
      return {
        address,
        balances
      };
    } catch (error) {
      console.error('❌ Wallet service error:', error);
      
      // Return minimal fallback
      return {
        address: '',
        balances: [
          { asset: 'ETH', amount: 0, chain: 'ethereum' },
          { asset: 'USDC', amount: 0, chain: 'ethereum' },
          { asset: 'XAUT', amount: 0, chain: 'ethereum' }
        ]
      };
    }
  }

  /**
   * Get real wallet balances from Ethereum mainnet for USDC, XAUT, and ETH
   */
  private async getWalletBalances(address: string): Promise<WalletBalance[]> {
    try {
      console.log('🔍 Fetching real balances for:', address);
      
      const provider = new ethers.JsonRpcProvider(this.ETHEREUM_RPC);
      
      // Get ETH balance
      const ethBalanceWei = await provider.getBalance(address);
      const ethBalance = parseFloat(ethers.formatEther(ethBalanceWei));
      
      // Get USDC balance
      const usdcContract = new ethers.Contract(
        this.USDC_CONTRACT,
        [
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        provider
      );
      
      // Get XAUT balance
      const xautContract = new ethers.Contract(
        this.XAUT_CONTRACT,
        [
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        provider
      );
      
      const [usdcBalanceRaw, usdcDecimals, xautBalanceRaw, xautDecimals] = await Promise.all([
        usdcContract.balanceOf(address),
        usdcContract.decimals(),
        xautContract.balanceOf(address),
        xautContract.decimals()
      ]);
      
      const usdcBalance = parseFloat(ethers.formatUnits(usdcBalanceRaw, usdcDecimals));
      const xautBalance = parseFloat(ethers.formatUnits(xautBalanceRaw, xautDecimals));
      
      const balances: WalletBalance[] = [
        { asset: 'ETH', amount: ethBalance, chain: 'ethereum' },
        { asset: 'USDC', amount: usdcBalance, chain: 'ethereum' },
        { asset: 'XAUT', amount: xautBalance, chain: 'ethereum' }
      ];
      
      console.log('✅ Real balances loaded:', balances);
      return balances;
      
    } catch (error) {
      console.error('❌ Failed to fetch real balances:', error);
      
      // Fallback to showing zero balances
      const fallbackBalances: WalletBalance[] = [
        { asset: 'ETH', amount: 0, chain: 'ethereum' },
        { asset: 'USDC', amount: 0, chain: 'ethereum' },
        { asset: 'XAUT', amount: 0, chain: 'ethereum' }
      ];
      
      console.log('⚠️ Using fallback balances:', fallbackBalances);
      return fallbackBalances;
    }
  }


  /**
   * Get stored wallet address
   */
  async getStoredAddress(userId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .limit(1);

      return data && data.length > 0 ? data[0].address : null;
    } catch (error) {
      console.warn('Could not fetch stored address:', error);
      return null;
    }
  }

  /**
   * Update balance snapshot in database
   */
  async updateBalanceSnapshot(userId: string, asset: string, amount: number): Promise<void> {
    try {
      await supabase
        .from('balance_snapshots')
        .insert({
          user_id: userId,
          asset,
          amount: amount // Keep as number, not string
        });
    } catch (error) {
      console.warn('Could not update balance snapshot:', error);
    }
  }
}

export const walletService = new WalletService();