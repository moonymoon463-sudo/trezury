import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";

// Token configurations
export const TOKENS = [
  { 
    symbol: 'USDC' as const, 
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    notLiveYet: false
  },
  { 
    symbol: 'XAUT' as const, 
    address: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
    decimals: 6,
    notLiveYet: false
  },
  { 
    symbol: 'TRZRY' as const, 
    address: '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B',
    decimals: 6,
    notLiveYet: true // Flag for graceful handling
  }
];

// RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  'https://eth-mainnet.g.alchemy.com/v2/demo',
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com'
];

// ERC20 ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export interface TokenBalance {
  symbol: string;
  address: string;
  balance: string; // formatted with decimals
  balanceRaw: bigint;
  decimals: number;
  error?: string;
}

export interface WalletBalances {
  eth: TokenBalance;
  tokens: TokenBalance[];
  timestamp: number;
  address: string;
}

class WalletBalancesService {
  private provider: ethers.JsonRpcProvider | null = null;
  private fallbackIndex = 0;
  private balanceCache = new Map<string, { data: WalletBalances; timestamp: number }>();
  private readonly CACHE_TTL = 10000; // 10 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [300, 900, 2700]; // exponential backoff in ms

  /**
   * Initialize provider with fallback support
   */
  private async getProvider(): Promise<ethers.JsonRpcProvider> {
    if (this.provider) {
      try {
        await this.provider.getBlockNumber(); // Test connection
        return this.provider;
      } catch (error) {
        console.warn('Primary provider failed, switching to fallback');
        this.provider = null;
      }
    }

    // Try current fallback
    const rpcUrl = RPC_ENDPOINTS[this.fallbackIndex];
    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      await this.provider.getBlockNumber(); // Validate
      console.log(`✅ Connected to RPC: ${rpcUrl}`);
      return this.provider;
    } catch (error) {
      console.error(`Failed to connect to ${rpcUrl}:`, error);
      
      // Try next fallback
      this.fallbackIndex = (this.fallbackIndex + 1) % RPC_ENDPOINTS.length;
      this.provider = null;
      
      if (this.fallbackIndex === 0) {
        throw new Error('All RPC endpoints failed');
      }
      
      return this.getProvider(); // Recursive retry with next endpoint
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async retry<T>(
    fn: () => Promise<T>,
    retries = this.MAX_RETRIES
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        const delay = this.RETRY_DELAYS[i];
        console.log(`Retry ${i + 1}/${retries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Get ETH balance
   */
  private async getEthBalance(address: string): Promise<TokenBalance> {
    const provider = await this.getProvider();
    
    const balanceRaw = await this.retry(() => provider.getBalance(address));
    
    return {
      symbol: 'ETH',
      address: 'native',
      balance: ethers.formatEther(balanceRaw),
      balanceRaw,
      decimals: 18
    };
  }

  /**
   * Get ERC20 token balance using multicall
   */
  private async getTokenBalances(
    walletAddress: string,
    tokens: typeof TOKENS
  ): Promise<TokenBalance[]> {
    const provider = await this.getProvider();
    const results: TokenBalance[] = [];

    // Batch all calls together (no actual multicall contract, but parallel)
    const balancePromises = tokens.map(async (token) => {
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        
        // Get balance and decimals in parallel
        const [balanceRaw, decimals] = await Promise.all([
          this.retry(() => contract.balanceOf(walletAddress)),
          token.decimals // Use pre-configured decimals
        ]);

        return {
          symbol: token.symbol,
          address: token.address,
          balance: ethers.formatUnits(balanceRaw, decimals),
          balanceRaw: BigInt(balanceRaw.toString()),
          decimals
        };
      } catch (error) {
        // Graceful handling for TRZRY if not deployed
        if (token.notLiveYet) {
          console.log(`Token ${token.symbol} not available yet, skipping`);
          return {
            symbol: token.symbol,
            address: token.address,
            balance: '0',
            balanceRaw: BigInt(0),
            decimals: token.decimals,
            error: 'not_deployed'
          };
        }
        
        console.error(`Failed to fetch ${token.symbol} balance:`, error);
        return {
          symbol: token.symbol,
          address: token.address,
          balance: '0',
          balanceRaw: BigInt(0),
          decimals: token.decimals,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(balancePromises);
  }

  /**
   * Get all balances for a wallet address
   */
  async getAllBalances(
    walletAddress: string,
    forceRefresh = false
  ): Promise<WalletBalances> {
    // Check cache first (stale-while-revalidate)
    const cacheKey = walletAddress.toLowerCase();
    const cached = this.balanceCache.get(cacheKey);
    
    if (!forceRefresh && cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('💰 Returning cached balances');
      // Return cached immediately, but refresh in background
      this.getAllBalances(walletAddress, true).catch(console.error);
      return cached.data;
    }

    try {
      // Fetch ETH and token balances in parallel
      const [eth, tokens] = await Promise.all([
        this.getEthBalance(walletAddress),
        this.getTokenBalances(walletAddress, TOKENS)
      ]);

      const result: WalletBalances = {
        eth,
        tokens,
        timestamp: Date.now(),
        address: walletAddress
      };

      // Update cache
      this.balanceCache.set(cacheKey, { data: result, timestamp: Date.now() });

      return result;
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      
      // If we have stale cache, return it with error flag
      if (cached) {
        console.warn('Returning stale cache due to error');
        return cached.data;
      }
      
      throw error;
    }
  }

  /**
   * Get formatted balance for display
   */
  formatBalance(balance: string, decimals: number): string {
    const num = parseFloat(balance);
    
    if (num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Clear cache for a specific address
   */
  invalidateCache(walletAddress?: string) {
    if (walletAddress) {
      this.balanceCache.delete(walletAddress.toLowerCase());
    } else {
      this.balanceCache.clear();
    }
  }
}

export const walletBalancesService = new WalletBalancesService();
