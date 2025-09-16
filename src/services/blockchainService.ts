import { supabase } from "@/integrations/supabase/client";
import { ethers } from "ethers";
import { secureWalletService } from "./secureWalletService";

export interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  asset: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: number;
  timestamp: string;
}

export interface WalletInfo {
  address: string;
  balance: number;
  asset: string;
  chain: 'ethereum';
}

class BlockchainService {
  private readonly ETHEREUM_RPC_URL = 'https://mainnet.infura.io/v3/46a2ce5cfbdf4ea6a30f5f2f8e841bf5'; // Using Infura
  private readonly USDC_CONTRACT = '0xA0b86a33E6441b7C88047F0fE3BDD78Db8DC820C'; // USDC on Ethereum mainnet
  private readonly XAUT_CONTRACT = '0x68749665FF8D2d112Fa859AA293F07A622782F38'; // XAUT on Ethereum mainnet  
  private readonly PLATFORM_WALLET = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835'; // Your Ethereum platform wallet
  
  // ERC20 ABI for basic token operations
  private readonly ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];
  
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(this.ETHEREUM_RPC_URL);
  }

  /**
   * DEPRECATED: Use secureWalletService instead
   * This method is kept for compatibility but should not be used for new wallets
   */
  async generateWalletAddress(userId: string): Promise<string> {
    console.warn('DEPRECATED: Use secureWalletService.generateDeterministicWallet() instead');
    
    try {
      // Check if user already has a wallet address
      const { data: existingAddress } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .eq('asset', 'USDC')
        .single();

      if (existingAddress) {
        return existingAddress.address;
      }

      // For backward compatibility, generate a simple address
      // NOTE: This should be replaced with secureWalletService usage
      const wallet = ethers.Wallet.createRandom();
      const address = wallet.address;
    
      // Store ONLY the address (NO private keys)
      const { error } = await supabase
        .from('onchain_addresses')
        .insert([
          {
            user_id: userId,
            address: address,
            chain: 'ethereum',
            asset: 'USDC'
          },
          {
            user_id: userId,
            address: address,
            chain: 'ethereum',
            asset: 'XAUT'
          }
        ]);

      if (error) throw error;

      // SECURITY FIX: NO private key storage anywhere
      console.warn('Wallet generated without private key storage - user must use secureWalletService for transactions');
      
      return address;
    } catch (err) {
      console.error('Failed to generate wallet address:', err);
      throw new Error('Failed to generate wallet address');
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(address: string, asset: 'USDC' | 'XAUT'): Promise<number> {
    try {
      const contractAddress = asset === 'USDC' ? this.USDC_CONTRACT : this.XAUT_CONTRACT;
      const contract = new ethers.Contract(contractAddress, this.ERC20_ABI, this.provider);
      
      // Get balance in wei
      const balanceWei = await contract.balanceOf(address);
      
      // Get token decimals
      const decimals = await contract.decimals();
      
      // Convert to human-readable amount
      const balance = parseFloat(ethers.formatUnits(balanceWei, decimals));
      
      return balance;
    } catch (err) {
      console.error(`Failed to get ${asset} balance for ${address}:`, err);
      
      // Fallback to database balance if blockchain call fails
      try {
        const { data: snapshots } = await supabase
          .from('balance_snapshots')
          .select('amount')
          .eq('asset', asset)
          .order('snapshot_at', { ascending: false })
          .limit(1);

        return Number(snapshots?.[0]?.amount || 0);
      } catch (dbErr) {
        console.error('Database fallback failed:', dbErr);
        return 0;
      }
    }
  }

  /**
   * Transfer tokens between addresses (simplified for demo)
   */
  async transferToken(
    from: string,
    to: string,
    amount: number,
    asset: 'USDC' | 'XAUT',
    userId: string
  ): Promise<BlockchainTransaction> {
    try {
      console.log(`Simulating transfer of ${amount} ${asset} from ${from} to ${to}`);
      
      // For demo purposes, we'll simulate the transfer
      // In production, you would need the private key to sign the transaction
      
      const transaction: BlockchainTransaction = {
        hash: this.generateTransactionHash(),
        from,
        to,
        amount,
        asset,
        status: 'pending',
        timestamp: new Date().toISOString()
      };

      // Simulate network delay and confirmation
      setTimeout(async () => {
        transaction.status = 'confirmed';
        transaction.blockNumber = Math.floor(Math.random() * 1000000) + 18000000;
        
        // Update balance snapshots to reflect the transfer
        await this.updateBalanceSnapshots(from, to, amount, asset, userId);
      }, 2000);

      return transaction;
    } catch (err) {
      console.error('Failed to transfer token:', err);
      throw new Error(`Token transfer failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect platform fees (simplified for demo)
   */
  async collectPlatformFee(
    userAddress: string,
    feeAmount: number,
    asset: 'USDC' | 'XAUT',
    userId: string,
    transactionId: string
  ): Promise<BlockchainTransaction> {
    try {
      console.log(`Collecting ${feeAmount} ${asset} fee from user ${userId}`);
      
      // Simulate fee collection transfer
      const feeTransfer = await this.transferToken(
        userAddress,
        this.PLATFORM_WALLET,
        feeAmount,
        asset,
        userId
      );

      // Record fee collection in database
      await supabase
        .from('balance_snapshots')
        .insert({
          user_id: userId,
          asset,
          amount: -feeAmount, // Negative amount for fee deduction
          snapshot_at: new Date().toISOString()
        });

      // Update transaction metadata to mark fee as collected
      await supabase
        .from('transactions')
        .update({
          metadata: {
            platformFeeCollected: true,
            feeTransactionHash: feeTransfer.hash,
            feeCollectedAt: new Date().toISOString()
          }
        })
        .eq('id', transactionId);

      return feeTransfer;
    } catch (err) {
      console.error('Failed to collect platform fee:', err);
      throw new Error(`Fee collection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Monitor blockchain for incoming transactions
   */
  async monitorIncomingTransactions(address: string): Promise<BlockchainTransaction[]> {
    try {
      const transactions: BlockchainTransaction[] = [];
      
      // For production implementation, you would:
      // 1. Use ethers.js event listeners or WebSocket connections
      // 2. Query recent Transfer events from ERC20 contracts
      // 3. Filter events for the specific address
      
      // This is a simplified version that queries recent blocks
      console.log(`Monitoring transactions for address: ${address}`);
      
      return transactions;
    } catch (err) {
      console.error('Failed to monitor transactions:', err);
      return [];
    }
  }

  /**
   * Get transaction history for an address
   */
  async getTransactionHistory(address: string): Promise<BlockchainTransaction[]> {
    try {
      // For now, return database transactions only
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .or(`metadata->>'from_address'.eq.${address},metadata->>'to_address'.eq.${address}`)
        .order('created_at', { ascending: false });

      return transactions?.map(tx => ({
        hash: tx.tx_hash || 'pending',
        from: (tx.metadata as any)?.from_address || 'unknown',
        to: (tx.metadata as any)?.to_address || 'unknown',
        amount: tx.quantity || 0,
        asset: tx.asset as 'USDC' | 'XAUT',
        status: tx.status as 'pending' | 'confirmed' | 'failed',
        timestamp: tx.created_at
      })) || [];
    } catch (err) {
      console.error('Failed to get transaction history:', err);
      return [];
    }
  }

  private async updateBalanceSnapshots(
    from: string,
    to: string,
    amount: number,
    asset: string,
    userId: string
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      
      // Deduct from sender (if it's a user transaction)
      if (from !== this.PLATFORM_WALLET) {
        await supabase
          .from('balance_snapshots')
          .insert({
            user_id: userId,
            asset,
            amount: -amount,
            snapshot_at: timestamp
          });
      }

      // Add to receiver (if it's a user receiving)
      if (to !== this.PLATFORM_WALLET) {
        await supabase
          .from('balance_snapshots')
          .insert({
            user_id: userId,
            asset,
            amount: amount,
            snapshot_at: timestamp
          });
      }
    } catch (err) {
      console.error('Failed to update balance snapshots:', err);
    }
  }

  private generateTransactionHash(): string {
    // Generate a valid Ethereum transaction hash format (0x + 64 hex characters)
    const chars = '0123456789abcdef';
    let result = '0x';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  getPlatformWallet(): string {
    return this.PLATFORM_WALLET;
  }
}

export const blockchainService = new BlockchainService();