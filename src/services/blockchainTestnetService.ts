import { ethers } from "ethers";

/**
 * Blockchain service for Sepolia testnet integration
 * Handles real balance reading, token contracts, and RPC connections
 */

// Sepolia testnet configuration
const SEPOLIA_RPC_URL = "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161";
const SEPOLIA_CHAIN_ID = 11155111;

// Test token contracts on Sepolia
export const TESTNET_CONTRACTS = {
  USDC: "0xA0b86a33E6417b62c1b3ed7Ce4c9d3D4A7BD8A68", // Mock USDC on Sepolia
  WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", // Sepolia WETH
  DAI: "0x3e0B3F6C08fB3C64D8b63c7e3F0B1e4D8B6C7B69"   // Mock DAI on Sepolia
};

// ERC20 ABI for token interactions
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

class BlockchainTestnetService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  }

  /**
   * Get real token balance from Sepolia testnet
   */
  async getTokenBalance(walletAddress: string, tokenSymbol: string): Promise<number> {
    try {
      console.log(`🔍 Fetching ${tokenSymbol} balance for ${walletAddress}`);
      
      if (tokenSymbol === 'ETH') {
        const balance = await this.provider.getBalance(walletAddress);
        return parseFloat(ethers.formatEther(balance));
      }

      const contractAddress = TESTNET_CONTRACTS[tokenSymbol as keyof typeof TESTNET_CONTRACTS];
      if (!contractAddress) {
        console.warn(`No contract address found for ${tokenSymbol}`);
        return 0;
      }

      const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
      const balance = await contract.balanceOf(walletAddress);
      const decimals = await contract.decimals();
      
      const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
      console.log(`✅ ${tokenSymbol} balance: ${formattedBalance}`);
      
      return formattedBalance;
    } catch (error) {
      console.error(`❌ Error fetching ${tokenSymbol} balance:`, error);
      return 0;
    }
  }

  /**
   * Alias for getTokenBalance for compatibility
   */
  async getBalance(walletAddress: string, tokenSymbol: string): Promise<number> {
    return this.getTokenBalance(walletAddress, tokenSymbol);
  }

  /**
   * Get multiple token balances at once
   */
  async getMultipleBalances(walletAddress: string, tokens: string[]): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};
    
    console.log(`🔍 Fetching balances for ${tokens.length} tokens`);
    
    const balancePromises = tokens.map(async (token) => {
      const balance = await this.getTokenBalance(walletAddress, token);
      return { token, balance };
    });

    const results = await Promise.all(balancePromises);
    
    results.forEach(({ token, balance }) => {
      balances[token] = balance;
    });

    console.log('✅ All balances fetched:', balances);
    return balances;
  }

  /**
   * Get testnet faucet URLs for users to get test tokens
   */
  getTestnetFaucets(): Record<string, string> {
    return {
      ETH: "https://sepoliafaucet.com/",
      USDC: "https://faucet.circle.com/", // If available
      general: "https://faucets.chain.link/sepolia"
    };
  }

  /**
   * Check if wallet address is valid
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      const gasPrice = await this.provider.getFeeData();
      return ethers.formatUnits(gasPrice.gasPrice || 0, "gwei");
    } catch (error) {
      console.error("Error fetching gas price:", error);
      return "0";
    }
  }

  /**
   * Get network info
   */
  getNetworkInfo() {
    return {
      name: "Sepolia Testnet",
      chainId: SEPOLIA_CHAIN_ID,
      rpcUrl: SEPOLIA_RPC_URL,
      blockExplorer: "https://sepolia.etherscan.io",
      nativeCurrency: {
        name: "SepoliaETH",
        symbol: "ETH",
        decimals: 18
      }
    };
  }

  /**
   * Create a contract instance for token interactions
   */
  getTokenContract(tokenSymbol: string, signer?: ethers.Signer): ethers.Contract | null {
    const contractAddress = TESTNET_CONTRACTS[tokenSymbol as keyof typeof TESTNET_CONTRACTS];
    if (!contractAddress) return null;

    return new ethers.Contract(
      contractAddress, 
      ERC20_ABI, 
      signer || this.provider
    );
  }
}

export const blockchainTestnetService = new BlockchainTestnetService();