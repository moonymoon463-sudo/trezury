import { supabase } from "@/integrations/supabase/client";
import { Chain, Token, LENDING_DEPOSIT_WALLETS } from "@/types/lending";

export class LendingWalletService {
  // Get the deposit wallet address for a specific chain and token
  static getDepositWallet(chain: Chain, token: Token): string {
    const wallet = LENDING_DEPOSIT_WALLETS[chain]?.[token];
    if (!wallet) {
      throw new Error(`No deposit wallet configured for ${token} on ${chain}`);
    }
    return wallet;
  }

  // Get all deposit wallets for a chain
  static getChainDepositWallets(chain: Chain): Record<Token, string> {
    return LENDING_DEPOSIT_WALLETS[chain];
  }

  // Generate deposit instructions for user
  static generateDepositInstructions(
    chain: Chain, 
    token: Token, 
    amount: number,
    lockId: string
  ): {
    depositAddress: string;
    amount: number;
    token: Token;
    chain: Chain;
    memo?: string;
    instructions: string[];
  } {
    const depositAddress = this.getDepositWallet(chain, token);
    
    const baseInstructions = [
      `1. Send exactly ${amount} ${token} to the deposit address`,
      `2. Use the correct network: ${chain}`,
      `3. Include the lock ID as memo/reference: ${lockId}`,
      `4. Wait for network confirmations`,
      `5. Your lock will activate once deposit is confirmed`
    ];

    const chainSpecificInstructions: Record<Chain, string[]> = {
      ethereum: [
        ...baseInstructions,
        `6. Ensure you have ETH for gas fees`,
        `7. Use a wallet that supports ERC-20 tokens`
      ],
      base: [
        ...baseInstructions,
        `6. Ensure you have ETH on Base for gas fees`,
        `7. Use Base network (not Ethereum mainnet)`
      ],
      solana: [
        ...baseInstructions,
        `6. Ensure you have SOL for transaction fees`,
        `7. Use a Solana-compatible wallet`
      ],
      tron: [
        ...baseInstructions,
        `6. Ensure you have TRX for energy/bandwidth`,
        `7. Use a TRON-compatible wallet`
      ]
    };

    return {
      depositAddress,
      amount,
      token,
      chain,
      memo: lockId,
      instructions: chainSpecificInstructions[chain]
    };
  }

  // Validate that a deposit wallet is properly configured
  static validateDepositWallet(chain: Chain, token: Token): boolean {
    try {
      const wallet = this.getDepositWallet(chain, token);
      
      // Basic validation - check if wallet address looks valid
      switch (chain) {
        case 'ethereum':
        case 'base':
          return /^0x[a-fA-F0-9]{40}$/.test(wallet);
        case 'solana':
          return wallet.length >= 32 && wallet.length <= 44;
        case 'tron':
          return wallet.startsWith('T') && wallet.length === 34;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  // Get supported tokens for a chain (only those with deposit wallets)
  static getSupportedTokens(chain: Chain): Token[] {
    const wallets = LENDING_DEPOSIT_WALLETS[chain];
    return Object.entries(wallets)
      .filter(([_, address]) => address && address.length > 0)
      .map(([token, _]) => token as Token);
  }

  // Check if a chain/token combination is supported for lending
  static isSupported(chain: Chain, token: Token): boolean {
    return this.validateDepositWallet(chain, token);
  }

  // Get deposit wallet balance (placeholder - would integrate with actual blockchain APIs)
  static async getDepositWalletBalance(chain: Chain, token: Token): Promise<number> {
    // This would integrate with actual blockchain APIs to check wallet balances
    // For now, return a placeholder
    console.log(`Checking balance for ${token} on ${chain}`);
    return 0;
  }

  // Record a deposit transaction
  static async recordDeposit(
    lockId: string,
    txHash: string,
    amount: number,
    chain: Chain,
    token: Token
  ): Promise<void> {
    const { error } = await supabase
      .from('locks')
      .update({
        deposit_tx: txHash,
        status: 'active' // Activate the lock once deposit is recorded
      })
      .eq('id', lockId);

    if (error) {
      throw new Error(`Failed to record deposit: ${error.message}`);
    }

    console.log(`Recorded deposit for lock ${lockId}: ${txHash}`);
  }
}