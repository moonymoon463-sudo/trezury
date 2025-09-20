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
  confirmations?: number;
  timestamp: string;
}

export interface WalletInfo {
  address: string;
  balance: number;
  asset: string;
  chain: 'ethereum';
}

class BlockchainService {
  // Live contract addresses on Ethereum mainnet
  private readonly USDC_CONTRACT = '0xA0b86a33E6441b7C88047F0fE3BDD78Db8DC820C';
  private readonly XAUT_CONTRACT = '0x68749665FF8D2d112Fa859AA293F07A622782F38';
  private readonly PLATFORM_WALLET = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835';
  
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
    // Initialize with demo provider - real RPC will be loaded via edge functions
    this.provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/demo');
    this.initializeSecureProvider();
  }

  /**
   * Initialize provider with live RPC URL from edge function
   */
  async initializeSecureProvider(): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: { operation: 'get_rpc_url' }
      });

      if (error) {
        console.error('Failed to get live RPC URL:', error);
        throw new Error('Cannot initialize live blockchain provider');
      }

      if (data?.rpcUrl) {
        this.provider = new ethers.JsonRpcProvider(data.rpcUrl);
        console.log('✅ Blockchain service initialized with LIVE provider');
      } else {
        throw new Error('No RPC URL received from edge function');
      }
    } catch (error) {
      console.error('Failed to initialize live provider:', error);
      throw error;
    }
  }

  /**
   * DEPRECATED: Use secureWalletService instead
   */
  async generateWalletAddress(userId: string): Promise<string> {
    console.warn('DEPRECATED: Use secureWalletService.generateDeterministicWallet() instead');
    
    try {
      const { data: existingAddress } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .eq('asset', 'USDC')
        .single();

      if (existingAddress) {
        return existingAddress.address;
      }

      const wallet = ethers.Wallet.createRandom();
      const address = wallet.address;
    
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

      console.warn('Wallet generated - user must use secureWalletService for transactions');
      return address;
    } catch (err) {
      console.error('Failed to generate wallet address:', err);
      throw new Error('Failed to generate wallet address');
    }
  }

  /**
   * Get LIVE token balance from blockchain
   */
  async getTokenBalance(address: string, asset: 'USDC' | 'XAUT'): Promise<number> {
    try {
      console.log(`🔴 Getting LIVE ${asset} balance for ${address}`);
      
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_balance',
          address,
          asset
        }
      });

      if (error) {
        console.error('LIVE balance retrieval error:', error);
        throw new Error(`Failed to get live ${asset} balance: ${error.message}`);
      }

      console.log(`✅ LIVE ${asset} balance: ${data?.balance}`);
      return data?.balance || 0;
    } catch (error) {
      console.error(`Error getting live ${asset} balance for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Execute LIVE token transfer via edge function
   */
  async transferToken(
    from: string,
    to: string,
    amount: number,
    asset: 'USDC' | 'XAUT',
    userId: string
  ): Promise<BlockchainTransaction> {
    try {
      console.log(`🔴 Executing LIVE transfer: ${amount} ${asset} from ${from} to ${to}`);
      
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'transfer',
          from,
          to,
          amount,
          asset,
          userId
        }
      });

      if (error) {
        throw new Error(`Live transfer failed: ${error.message}`);
      }

      const transaction: BlockchainTransaction = {
        hash: data.hash,
        from: data.from,
        to: data.to,
        amount: data.amount,
        asset: data.asset,
        status: data.status,
        confirmations: data.confirmations || 0,
        timestamp: new Date().toISOString()
      };

      // Record live transaction in database
      const { error: dbError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'transfer',
          asset,
          quantity: amount,
          status: 'completed',
          tx_hash: data.hash,
          metadata: {
            from,
            to,
            transfer_type: 'LIVE_TOKEN_TRANSFER',
            blockchain_confirmations: data.confirmations,
            live_mode: true
          }
        });

      if (dbError) {
        console.error('Failed to record live transaction:', dbError);
      }

      await this.updateBalanceSnapshots(from, to, amount, asset, userId);

      console.log(`✅ LIVE transfer completed: ${data.hash}`);
      return transaction;
    } catch (error) {
      console.error(`LIVE transfer error:`, error);
      throw error;
    }
  }

  /**
   * Execute LIVE platform fee collection
   */
  async collectPlatformFee(
    userAddress: string,
    feeAmount: number,
    asset: 'USDC' | 'XAUT',
    userId: string,
    transactionId: string
  ): Promise<BlockchainTransaction> {
    try {
      console.log(`🔴 Executing LIVE fee collection: ${feeAmount} ${asset} from user ${userId}`);
      
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'collect_fee',
          userAddress,
          feeAmount,
          asset,
          userId,
          transactionId
        }
      });

      if (error) {
        throw new Error(`Live fee collection failed: ${error.message}`);
      }

      const transaction: BlockchainTransaction = {
        hash: data.hash,
        from: data.from,
        to: data.to,
        amount: data.feeAmount,
        asset: data.asset,
        status: data.status,
        confirmations: 1,
        timestamp: new Date().toISOString()
      };

      // Record live fee collection transaction
      const { error: dbError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'fee_collection',
          asset,
          quantity: feeAmount,
          status: 'completed',
          tx_hash: data.hash,
          metadata: {
            platform_fee: true,
            original_transaction_id: transactionId,
            fee_collection_type: 'LIVE_PLATFORM_FEE',
            blockchain_hash: data.hash,
            live_mode: true
          }
        });

      if (dbError) {
        console.error('Failed to record live fee collection transaction:', dbError);
      }

      // Update platform balance with live fee
      await supabase
        .from('balance_snapshots')
        .insert({
          user_id: userId,
          asset,
          amount: feeAmount,
          snapshot_at: new Date().toISOString()
        });

      console.log(`✅ LIVE fee collection completed: ${data.hash}`);
      return transaction;
    } catch (error) {
      console.error(`LIVE fee collection error:`, error);
      throw error;
    }
  }

  /**
   * Monitor blockchain for incoming transactions
   */
  async monitorIncomingTransactions(address: string): Promise<BlockchainTransaction[]> {
    try {
      const transactions: BlockchainTransaction[] = [];
      console.log(`🔴 Monitoring LIVE transactions for address: ${address}`);
      
      // In production, you would use ethers.js event listeners
      // For now, return empty array as monitoring is handled separately
      
      return transactions;
    } catch (err) {
      console.error('Failed to monitor live transactions:', err);
      return [];
    }
  }

  /**
   * Get transaction history for an address
   */
  async getTransactionHistory(address: string): Promise<BlockchainTransaction[]> {
    try {
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