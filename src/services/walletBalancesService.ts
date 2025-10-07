import { ethers } from 'ethers';

// Token configuration
const TOKENS = [
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'XAUT', address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', decimals: 6 },
  { symbol: 'TRZRY', address: '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B', decimals: 18 }, // Will be detected
] as const;

// RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  'https://eth-mainnet.g.alchemy.com/v2/demo', // Primary (rate limited, will fallback)
  'https://rpc.ankr.com/eth',                  // Fallback 1
  'https://eth.llamarpc.com',                   // Fallback 2
  'https://ethereum.publicnode.com',            // Fallback 3
];

// Multicall3 contract (deployed on all major chains)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' }
        ],
        name: 'calls',
        type: 'tuple[]'
      }
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' }
        ],
        name: 'returnData',
        type: 'tuple[]'
      }
    ],
    stateMutability: 'payable',
    type: 'function'
  }
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export interface WalletBalance {
  asset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY';
  amount: number;
  rawAmount: string;
  decimals: number;
  chain: string;
}

interface BalanceCache {
  balances: WalletBalance[];
  timestamp: number;
}

const CACHE_KEY = 'wallet_balances_cache';
const CACHE_DURATION_MS = 30000; // 30 seconds for desktop, will be adjusted for mobile

class WalletBalancesService {
  private providers: ethers.JsonRpcProvider[] = [];
  private currentRpcIndex = 0;
  private tokenDecimals = new Map<string, number>();
  private requestId = 0;
  private activeRequests = new Map<number, AbortController>();
  private isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  constructor() {
    this.initializeProviders();
    this.loadCachedDecimals();
  }

  private initializeProviders() {
    this.providers = RPC_ENDPOINTS.map(url => new ethers.JsonRpcProvider(url));
  }

  private getCurrentProvider(): ethers.JsonRpcProvider {
    return this.providers[this.currentRpcIndex];
  }

  private switchToNextRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.providers.length;
    console.log(`🔄 Switched to RPC ${this.currentRpcIndex + 1}/${this.providers.length}`);
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempts = 3,
    baseDelay = 300
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        const isLastAttempt = i === attempts - 1;
        
        if (isLastAttempt) {
          // Try next RPC provider
          this.switchToNextRpc();
          throw error;
        }

        // Exponential backoff: 300ms, 900ms, 2700ms
        const delay = baseDelay * Math.pow(3, i);
        console.log(`⏳ Retry ${i + 1}/${attempts} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry failed');
  }

  private loadCachedDecimals() {
    try {
      const cached = localStorage.getItem('token_decimals_cache');
      if (cached) {
        const data = JSON.parse(cached);
        this.tokenDecimals = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Failed to load cached decimals:', error);
    }
  }

  private saveCachedDecimals() {
    try {
      const data = Object.fromEntries(this.tokenDecimals);
      localStorage.setItem('token_decimals_cache', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save cached decimals:', error);
    }
  }

  private getCachedBalances(): WalletBalance[] | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: BalanceCache = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      const maxAge = this.isMobile ? 300000 : CACHE_DURATION_MS; // 5 min mobile, 30s desktop

      if (age > maxAge) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      console.log(`📦 Using cached balances (age: ${Math.round(age / 1000)}s)`);
      return data.balances;
    } catch (error) {
      console.error('Failed to load cached balances:', error);
      return null;
    }
  }

  private setCachedBalances(balances: WalletBalance[]) {
    try {
      const cache: BalanceCache = {
        balances,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to cache balances:', error);
    }
  }

  private async getTokenDecimals(tokenAddress: string): Promise<number> {
    // Check cache first
    if (this.tokenDecimals.has(tokenAddress)) {
      return this.tokenDecimals.get(tokenAddress)!;
    }

    // Fetch from blockchain
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.getCurrentProvider());
    
    try {
      const decimals = await this.retryWithBackoff(async () => {
        return await contract.decimals();
      });
      
      this.tokenDecimals.set(tokenAddress, decimals);
      this.saveCachedDecimals();
      return decimals;
    } catch (error) {
      console.error(`Failed to fetch decimals for ${tokenAddress}:`, error);
      // Fallback to standard 18 decimals
      return 18;
    }
  }

  private async fetchBalancesWithMulticall(
    address: string,
    abortSignal?: AbortSignal
  ): Promise<WalletBalance[]> {
    if (abortSignal?.aborted) {
      throw new Error('Request cancelled');
    }

    const provider = this.getCurrentProvider();
    const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
    
    // Build multicall calls for all tokens
    const calls = await Promise.all(
      TOKENS.map(async (token) => {
        const iface = new ethers.Interface(ERC20_ABI);
        const callData = iface.encodeFunctionData('balanceOf', [address]);
        
        return {
          target: token.address,
          allowFailure: true, // Don't fail entire batch if one token fails
          callData,
        };
      })
    );

    // Execute multicall
    const results = await this.retryWithBackoff(async () => {
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled');
      }
      return await multicall.aggregate3(calls);
    });

    // Get ETH balance separately
    const ethBalance = await this.retryWithBackoff(async () => {
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled');
      }
      return await provider.getBalance(address);
    });

    // Parse results
    const balances: WalletBalance[] = [];

    // Add ETH balance
    balances.push({
      asset: 'ETH',
      amount: parseFloat(ethers.formatEther(ethBalance)),
      rawAmount: ethBalance.toString(),
      decimals: 18,
      chain: 'ethereum',
    });

    // Add token balances
    for (let i = 0; i < TOKENS.length; i++) {
      const token = TOKENS[i];
      const result = results[i];

      if (!result.success) {
        console.warn(`Failed to fetch ${token.symbol} balance, treating as unavailable`);
        // For TRZRY (might not be deployed yet), show as 0
        if (token.symbol === 'TRZRY') {
          balances.push({
            asset: token.symbol,
            amount: 0,
            rawAmount: '0',
            decimals: token.decimals,
            chain: 'ethereum',
          });
        }
        continue;
      }

      try {
        const iface = new ethers.Interface(ERC20_ABI);
        const [rawBalance] = iface.decodeFunctionResult('balanceOf', result.returnData);
        
        // Get decimals (cached or fetch once)
        const decimals = await this.getTokenDecimals(token.address);
        const amount = parseFloat(ethers.formatUnits(rawBalance, decimals));

        balances.push({
          asset: token.symbol as 'USDC' | 'XAUT' | 'TRZRY',
          amount,
          rawAmount: rawBalance.toString(),
          decimals,
          chain: 'ethereum',
        });
      } catch (error) {
        console.error(`Error parsing ${token.symbol} balance:`, error);
      }
    }

    return balances;
  }

  async fetchBalances(address: string, forceRefresh = false): Promise<{
    balances: WalletBalance[];
    fromCache: boolean;
  }> {
    // Return cached balances unless force refresh
    if (!forceRefresh) {
      const cached = this.getCachedBalances();
      if (cached) {
        // Start background refresh
        this.fetchBalances(address, true).catch(console.error);
        return { balances: cached, fromCache: true };
      }
    }

    // Create abort controller for this request
    const reqId = ++this.requestId;
    const controller = new AbortController();
    this.activeRequests.set(reqId, controller);

    try {
      console.log(`🔍 Fetching balances for ${address} (RPC ${this.currentRpcIndex + 1})`);
      
      const balances = await this.fetchBalancesWithMulticall(address, controller.signal);
      
      // Cache the results
      this.setCachedBalances(balances);
      
      console.log(`✅ Fetched ${balances.length} balances`);
      return { balances, fromCache: false };
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      
      // Return cached balances as fallback
      const cached = this.getCachedBalances();
      if (cached) {
        console.log('📦 Returning stale cached balances due to error');
        return { balances: cached, fromCache: true };
      }
      
      throw error;
    } finally {
      this.activeRequests.delete(reqId);
    }
  }

  cancelAllRequests() {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  clearCache() {
    localStorage.removeItem(CACHE_KEY);
  }
}

export const walletBalancesService = new WalletBalancesService();
