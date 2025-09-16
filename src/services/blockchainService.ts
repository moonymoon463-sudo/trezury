import { supabase } from "@/integrations/supabase/client";
import { ethers } from "ethers";

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
  private readonly PLATFORM_WALLET = '0x742d35Cc6634C0532925a3b8D69B8e6b4f5c5a4c'; // Your Ethereum platform wallet
  private readonly PLATFORM_PRIVATE_KEY = process.env.PLATFORM_PRIVATE_KEY || ''; // Private key for fee collection
  
  // ERC20 ABI for basic token operations
  private readonly ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)"
  ];
  
  private provider: ethers.JsonRpcProvider;
  private platformWallet: ethers.Wallet | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(this.ETHEREUM_RPC_URL);
    if (this.PLATFORM_PRIVATE_KEY) {
      this.platformWallet = new ethers.Wallet(this.PLATFORM_PRIVATE_KEY, this.provider);
    }
  }

  /**
   * Generate a new Ethereum address for a user
   */
  async generateWalletAddress(userId: string): Promise<string> {
    try {
      // Generate a new random wallet
      const wallet = ethers.Wallet.createRandom();
      const address = wallet.address;
    
      // Store both USDC and XAUT addresses for the user
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
            address: address, // Same address can hold multiple ERC20 tokens
            chain: 'ethereum',
            asset: 'XAUT'
          }
        ]);

      if (error) throw error;

      // Store the private key encrypted in the database for user wallet management
      // NOTE: In production, use proper key management service (AWS KMS, HashiCorp Vault, etc.)
      const { error: keyError } = await supabase
        .from('user_wallet_keys')
        .insert({
          user_id: userId,
          encrypted_private_key: this.encryptPrivateKey(wallet.privateKey, userId),
          address: address
        });

      if (keyError) console.warn('Failed to store encrypted private key:', keyError);
      
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
   * Transfer tokens between addresses
   */
  async transferToken(
    from: string,
    to: string,
    amount: number,
    asset: 'USDC' | 'XAUT',
    userId: string
  ): Promise<BlockchainTransaction> {
    try {
      if (!this.platformWallet) {
        throw new Error('Platform wallet not configured');
      }

      const contractAddress = asset === 'USDC' ? this.USDC_CONTRACT : this.XAUT_CONTRACT;
      const contract = new ethers.Contract(contractAddress, this.ERC20_ABI, this.platformWallet);
      
      // Get token decimals for proper amount conversion
      const decimals = await contract.decimals();
      const amountWei = ethers.parseUnits(amount.toString(), decimals);
      
      // Estimate gas
      const gasEstimate = await contract.transfer.estimateGas(to, amountWei);
      const gasPrice = await this.provider.getFeeData();
      
      // Execute the transfer
      const tx = await contract.transfer(to, amountWei, {
        gasLimit: gasEstimate,
        gasPrice: gasPrice.gasPrice
      });
      
      const transaction: BlockchainTransaction = {
        hash: tx.hash,
        from,
        to,
        amount,
        asset,
        status: 'pending',
        timestamp: new Date().toISOString()
      };

      // Wait for confirmation
      const receipt = await tx.wait();
      
      transaction.status = receipt?.status === 1 ? 'confirmed' : 'failed';
      transaction.blockNumber = receipt?.blockNumber;
      transaction.gasUsed = Number(receipt?.gasUsed || 0);
      
      // Update balance snapshots to reflect the transfer
      if (transaction.status === 'confirmed') {
        await this.updateBalanceSnapshots(from, to, amount, asset, userId);
      }

      return transaction;
    } catch (err) {
      console.error('Failed to transfer token:', err);
      
      const errorTransaction: BlockchainTransaction = {
        hash: '',
        from,
        to,
        amount,
        asset,
        status: 'failed',
        timestamp: new Date().toISOString()
      };
      
      throw new Error(`Token transfer failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect platform fees by transferring to platform wallet
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
      
      // Get user's encrypted private key to sign the transaction
      const userWallet = await this.getUserWallet(userId);
      if (!userWallet) {
        throw new Error('User wallet not found');
      }
      
      const contractAddress = asset === 'USDC' ? this.USDC_CONTRACT : this.XAUT_CONTRACT;
      const contract = new ethers.Contract(contractAddress, this.ERC20_ABI, userWallet);
      
      // Get token decimals for proper amount conversion
      const decimals = await contract.decimals();
      const amountWei = ethers.parseUnits(feeAmount.toString(), decimals);
      
      // Execute the fee transfer from user to platform
      const tx = await contract.transfer(this.PLATFORM_WALLET, amountWei);
      
      const feeTransfer: BlockchainTransaction = {
        hash: tx.hash,
        from: userAddress,
        to: this.PLATFORM_WALLET,
        amount: feeAmount,
        asset,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
      
      // Wait for confirmation
      const receipt = await tx.wait();
      feeTransfer.status = receipt?.status === 1 ? 'confirmed' : 'failed';
      feeTransfer.blockNumber = receipt?.blockNumber;
      feeTransfer.gasUsed = Number(receipt?.gasUsed || 0);

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
      
      // Monitor USDC transfers
      const usdcContract = new ethers.Contract(this.USDC_CONTRACT, this.ERC20_ABI, this.provider);
      const xautContract = new ethers.Contract(this.XAUT_CONTRACT, this.ERC20_ABI, this.provider);
      
      // Get recent Transfer events for this address
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = currentBlock - 1000; // Last ~1000 blocks
      
      // USDC transfers
      const usdcFilter = usdcContract.filters.Transfer(null, address);
      const usdcEvents = await usdcContract.queryFilter(usdcFilter, fromBlock);
      
      // XAUT transfers  
      const xautFilter = xautContract.filters.Transfer(null, address);
      const xautEvents = await xautContract.queryFilter(xautFilter, fromBlock);
      
      // Process USDC events
      for (const event of usdcEvents) {
        const block = await this.provider.getBlock(event.blockNumber);
        transactions.push({
          hash: event.transactionHash,
          from: event.args?.[0] || '',
          to: event.args?.[1] || '',
          amount: parseFloat(ethers.formatUnits(event.args?.[2] || 0, 6)), // USDC has 6 decimals
          asset: 'USDC',
          status: 'confirmed',
          blockNumber: event.blockNumber,
          timestamp: new Date((block?.timestamp || 0) * 1000).toISOString()
        });
      }
      
      // Process XAUT events
      for (const event of xautEvents) {
        const block = await this.provider.getBlock(event.blockNumber);
        transactions.push({
          hash: event.transactionHash,
          from: event.args?.[0] || '',
          to: event.args?.[1] || '',
          amount: parseFloat(ethers.formatUnits(event.args?.[2] || 0, 6)), // XAUT has 6 decimals
          asset: 'XAUT',
          status: 'confirmed',
          blockNumber: event.blockNumber,
          timestamp: new Date((block?.timestamp || 0) * 1000).toISOString()
        });
      }
      
      return transactions.sort((a, b) => b.blockNumber! - a.blockNumber!);
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
      // Combine blockchain and database transaction history
      const blockchainTxs = await this.monitorIncomingTransactions(address);
      
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .or(`metadata->>'from_address'.eq.${address},metadata->>'to_address'.eq.${address}`)
        .order('created_at', { ascending: false });

      const dbTxs = transactions?.map(tx => ({
        hash: tx.tx_hash || 'pending',
        from: (tx.metadata as any)?.from_address || 'unknown',
        to: (tx.metadata as any)?.to_address || 'unknown',
        amount: tx.quantity || 0,
        asset: tx.asset as 'USDC' | 'XAUT',
        status: tx.status as 'pending' | 'confirmed' | 'failed',
        timestamp: tx.created_at
      })) || [];
      
      // Merge and deduplicate by transaction hash
      const allTxs = [...blockchainTxs, ...dbTxs];
      const uniqueTxs = allTxs.reduce((acc, tx) => {
        if (!acc.find(existing => existing.hash === tx.hash)) {
          acc.push(tx);
        }
        return acc;
      }, [] as BlockchainTransaction[]);
      
      return uniqueTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

  /**
   * Get user's wallet for transaction signing
   */
  private async getUserWallet(userId: string): Promise<ethers.Wallet | null> {
    try {
      const { data: walletData } = await supabase
        .from('user_wallet_keys')
        .select('encrypted_private_key, address')
        .eq('user_id', userId)
        .single();
        
      if (!walletData) {
        return null;
      }
      
      const privateKey = this.decryptPrivateKey(walletData.encrypted_private_key, userId);
      return new ethers.Wallet(privateKey, this.provider);
    } catch (err) {
      console.error('Failed to get user wallet:', err);
      return null;
    }
  }

  /**
   * Encrypt private key for storage (simple implementation)
   * In production, use proper encryption service
   */
  private encryptPrivateKey(privateKey: string, userId: string): string {
    // Simple XOR encryption - replace with proper encryption in production
    const key = userId.slice(0, 8);
    let encrypted = '';
    for (let i = 0; i < privateKey.length; i++) {
      encrypted += String.fromCharCode(privateKey.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return Buffer.from(encrypted).toString('base64');
  }

  /**
   * Decrypt private key (simple implementation)
   */
  private decryptPrivateKey(encryptedKey: string, userId: string): string {
    const key = userId.slice(0, 8);
    const encrypted = Buffer.from(encryptedKey, 'base64').toString();
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return decrypted;
  }

  getPlatformWallet(): string {
    return this.PLATFORM_WALLET;
  }
}

export const blockchainService = new BlockchainService();