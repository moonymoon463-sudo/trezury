/**
 * Synthetix Account Service
 * Handles programmatic creation of Synthetix trading accounts
 */

import { ethers, type Signer } from 'ethers';
import { supabase } from '@/integrations/supabase/client';
import { getSnxAddresses } from '@/config/snxAddresses';

// Account NFT contract ABI (for creating new accounts)
const ACCOUNT_NFT_ABI = [
  'function mint(uint128 requestedAccountId, address owner) external',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function getAccountPermissions(uint128 accountId) view returns (address[])',
  'function getAccountTokenId(address accountOwner, uint128 accountId) view returns (uint256)'
];

export interface AccountCreationResult {
  success: boolean;
  accountId?: bigint;
  txHash?: string;
  error?: string;
}

class SnxAccountService {
  /**
   * Create a new Synthetix trading account
   * This mints an Account NFT which represents the trading account
   */
  async createAccount(
    signer: Signer,
    chainId: number = 8453
  ): Promise<AccountCreationResult> {
    try {
      const addresses = getSnxAddresses(chainId);
      const address = await signer.getAddress();
      
      console.log('[SnxAccountService] Creating account for:', address);
      console.log('[SnxAccountService] Using contract:', addresses.accountProxy);

      // Check wallet balance before attempting
      const provider = signer.provider;
      if (provider) {
        const balance = await provider.getBalance(address);
        console.log('[SnxAccountService] Wallet balance:', ethers.formatEther(balance), 'ETH');
        
        if (balance === 0n) {
          return {
            success: false,
            error: 'Wallet has no ETH for gas. Please fund your wallet or enable gas sponsorship.'
          };
        }
      }

      // Connect to Account NFT contract
      const accountNFT = new ethers.Contract(
        addresses.accountProxy,
        ACCOUNT_NFT_ABI,
        signer
      );

      // Check if user already has an account
      const balance = await accountNFT.balanceOf(address);
      if (balance > 0n) {
        // User already has an account, get the first one
        const accountId = await accountNFT.tokenOfOwnerByIndex(address, 0);
        console.log('[SnxAccountService] Account already exists:', accountId);
        
        // Store in database
        await this.storeAccountInDatabase(address, accountId, chainId);
        
        return {
          success: true,
          accountId: accountId
        };
      }

      // Generate a random account ID
      // Synthetix uses uint128, so we generate a random number in that range
      const randomAccountId = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      
      console.log('[SnxAccountService] Minting new account with ID:', randomAccountId);

      // Estimate gas before sending transaction
      try {
        const gasEstimate = await accountNFT.mint.estimateGas(randomAccountId, address);
        console.log('[SnxAccountService] Estimated gas:', gasEstimate.toString());
      } catch (gasError) {
        console.error('[SnxAccountService] Gas estimation failed:', gasError);
        return {
          success: false,
          error: 'Gas estimation failed. The transaction may not succeed. Ensure you have enough ETH or enable gas sponsorship.'
        };
      }

      // Mint new account NFT
      const tx = await accountNFT.mint(randomAccountId, address);
      console.log('[SnxAccountService] Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('[SnxAccountService] Transaction confirmed:', receipt.hash);

      // The account ID is the token ID that was minted
      // We use the requested ID since Synthetix allows custom IDs
      const accountId = randomAccountId;

      // Store in database
      await this.storeAccountInDatabase(address, accountId, chainId, receipt.hash);

      return {
        success: true,
        accountId,
        txHash: receipt.hash
      };
    } catch (error) {
      console.error('[SnxAccountService] Account creation failed:', error);
      
      // Parse error message for user-friendly feedback
      let errorMessage = 'Failed to create account';
      if (error instanceof Error) {
        if (error.message.includes('cannot estimate gas')) {
          errorMessage = 'Gas estimation failed - wallet may need ETH or contract may be paused';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas';
        } else if (error.message.includes('nonce')) {
          errorMessage = 'Transaction nonce error - please try again';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if a wallet address has a Synthetix account
   */
  async checkForAccount(
    address: string,
    chainId: number = 8453
  ): Promise<bigint | null> {
    try {
      const addresses = getSnxAddresses(chainId);
      const provider = new ethers.JsonRpcProvider(
        chainId === 8453 ? 'https://mainnet.base.org' :
        chainId === 1 ? 'https://eth.llamarpc.com' :
        chainId === 42161 ? 'https://arb1.arbitrum.io/rpc' :
        'https://mainnet.optimism.io'
      );

      const accountNFT = new ethers.Contract(
        addresses.accountProxy,
        ACCOUNT_NFT_ABI,
        provider
      );

      const balance = await accountNFT.balanceOf(address);
      
      if (balance > 0n) {
        const accountId = await accountNFT.tokenOfOwnerByIndex(address, 0);
        
        // Also store in database if not already there
        await this.storeAccountInDatabase(address, accountId, chainId);
        
        return accountId;
      }

      return null;
    } catch (error) {
      console.error('[SnxAccountService] Check account failed:', error);
      return null;
    }
  }

  /**
   * Store account information in Supabase
   */
  private async storeAccountInDatabase(
    walletAddress: string,
    accountId: bigint,
    chainId: number,
    txHash?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[SnxAccountService] No authenticated user to store account');
        return;
      }

      // Check if account already exists
      const { data: existing } = await supabase
        .from('snx_accounts')
        .select('id')
        .eq('account_id', accountId.toString())
        .eq('chain_id', chainId)
        .single();

      if (existing) {
        console.log('[SnxAccountService] Account already in database');
        return;
      }

      // Insert new account record
      const { error } = await supabase
        .from('snx_accounts')
        .insert({
          user_id: user.id,
          account_id: accountId.toString(),
          wallet_address: walletAddress.toLowerCase(),
          chain_id: chainId,
          creation_tx: txHash
        });

      if (error) {
        console.error('[SnxAccountService] Database insert failed:', error);
      } else {
        console.log('[SnxAccountService] Account stored in database');
      }
    } catch (error) {
      console.error('[SnxAccountService] Store account error:', error);
    }
  }

  /**
   * Get all accounts for a user
   */
  async getUserAccounts(chainId: number = 8453): Promise<bigint[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('snx_accounts')
        .select('account_id')
        .eq('user_id', user.id)
        .eq('chain_id', chainId);

      if (error || !data) return [];

      return data.map(row => BigInt(row.account_id));
    } catch (error) {
      console.error('[SnxAccountService] Get user accounts failed:', error);
      return [];
    }
  }
}

export const snxAccountService = new SnxAccountService();
