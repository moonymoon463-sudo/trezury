import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import { Chain, Token } from "@/types/lending";
import LendingPoolABI from "@/contracts/abis/LendingPool.json";
import ERC20ABI from "@/contracts/abis/ERC20.json";
import { contractDeploymentService, ContractAddresses } from "./contractDeploymentService";

export interface ContractTransaction {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
  timestamp: string;
}

export interface SupplyParams {
  asset: string;
  amount: string;
  onBehalfOf: string;
  referralCode: number;
}

export interface BorrowParams {
  asset: string;
  amount: string;
  interestRateMode: number; // 1 for stable, 2 for variable
  referralCode: number;
  onBehalfOf: string;
}

export interface WithdrawParams {
  asset: string;
  amount: string;
  to: string;
}

export interface RepayParams {
  asset: string;
  amount: string;
  rateMode: number;
  onBehalfOf: string;
}

class SmartContractService {
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;
  private contractAddresses: Record<Chain, ContractAddresses | null> = {
    ethereum: null,
    base: null,
    solana: null,
    tron: null
  };

  /**
   * Initialize the service with a provider and signer
   */
  async initialize(provider: ethers.Provider, signer: ethers.Signer): Promise<void> {
    this.provider = provider;
    this.signer = signer;
    
    // Load contract addresses for all chains
    await this.loadContractAddresses();
    
    console.log("✅ SmartContractService initialized");
  }

  /**
   * Load deployed contract addresses from database
   */
  private async loadContractAddresses(): Promise<void> {
    const chains: Chain[] = ['ethereum', 'base'];
    
    for (const chain of chains) {
      const addresses = await contractDeploymentService.getContractAddresses(chain);
      this.contractAddresses[chain] = addresses;
      
      if (addresses) {
        console.log(`📋 Loaded contract addresses for ${chain}`);
      } else {
        console.log(`⚠️ No contract addresses found for ${chain}`);
      }
    }
  }

  /**
   * Get LendingPool contract instance
   */
  private getLendingPoolContract(chain: Chain): ethers.Contract {
    const addresses = this.contractAddresses[chain];
    if (!addresses?.lendingPool) {
      throw new Error(`LendingPool not deployed on ${chain}`);
    }

    if (!this.signer) {
      throw new Error("Signer not initialized");
    }

    return new ethers.Contract(addresses.lendingPool, LendingPoolABI, this.signer);
  }

  /**
   * Get ERC20 token contract instance
   */
  private getTokenContract(chain: Chain, token: Token): ethers.Contract {
    const addresses = this.contractAddresses[chain];
    if (!addresses?.tokens[token]) {
      throw new Error(`${token} token not deployed on ${chain}`);
    }

    if (!this.signer) {
      throw new Error("Signer not initialized");
    }

    return new ethers.Contract(addresses.tokens[token], ERC20ABI, this.signer);
  }

  /**
   * Supply assets to the lending pool
   */
  async supply(
    chain: Chain,
    token: Token,
    amount: string,
    userAddress: string
  ): Promise<ContractTransaction> {
    try {
      console.log(`🏦 Supplying ${amount} ${token} to ${chain} lending pool...`);

      const lendingPool = this.getLendingPoolContract(chain);
      const tokenContract = this.getTokenContract(chain, token);
      const addresses = this.contractAddresses[chain]!;

      // 1. Check and approve tokens if needed
      const allowance = await tokenContract.allowance(userAddress, addresses.lendingPool);
      const amountBN = ethers.parseUnits(amount, await tokenContract.decimals());

      if (allowance < amountBN) {
        console.log("📝 Approving tokens for lending pool...");
        const approveTx = await tokenContract.approve(addresses.lendingPool, amountBN);
        await approveTx.wait();
        console.log("✅ Token approval confirmed");
      }

      // 2. Supply to lending pool
      const supplyParams: SupplyParams = {
        asset: addresses.tokens[token],
        amount: amountBN.toString(),
        onBehalfOf: userAddress,
        referralCode: 0
      };

      const tx = await lendingPool.deposit(
        supplyParams.asset,
        supplyParams.amount,
        supplyParams.onBehalfOf,
        supplyParams.referralCode
      );

      const receipt = await tx.wait();
      
      const transaction: ContractTransaction = {
        hash: tx.hash,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        confirmations: receipt.confirmations || 1,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Supply transaction confirmed: ${tx.hash}`);
      return transaction;

    } catch (error) {
      console.error("Supply transaction failed:", error);
      throw new Error(`Supply failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw assets from the lending pool
   */
  async withdraw(
    chain: Chain,
    token: Token,
    amount: string,
    userAddress: string
  ): Promise<ContractTransaction> {
    try {
      console.log(`💰 Withdrawing ${amount} ${token} from ${chain} lending pool...`);

      const lendingPool = this.getLendingPoolContract(chain);
      const tokenContract = this.getTokenContract(chain, token);
      const addresses = this.contractAddresses[chain]!;

      const amountBN = ethers.parseUnits(amount, await tokenContract.decimals());

      const withdrawParams: WithdrawParams = {
        asset: addresses.tokens[token],
        amount: amountBN.toString(),
        to: userAddress
      };

      const tx = await lendingPool.withdraw(
        withdrawParams.asset,
        withdrawParams.amount,
        withdrawParams.to
      );

      const receipt = await tx.wait();
      
      const transaction: ContractTransaction = {
        hash: tx.hash,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        confirmations: receipt.confirmations || 1,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Withdraw transaction confirmed: ${tx.hash}`);
      return transaction;

    } catch (error) {
      console.error("Withdraw transaction failed:", error);
      throw new Error(`Withdraw failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Borrow assets from the lending pool
   */
  async borrow(
    chain: Chain,
    token: Token,
    amount: string,
    userAddress: string,
    interestRateMode: 1 | 2 = 2 // Default to variable rate
  ): Promise<ContractTransaction> {
    try {
      console.log(`📊 Borrowing ${amount} ${token} from ${chain} lending pool...`);

      const lendingPool = this.getLendingPoolContract(chain);
      const tokenContract = this.getTokenContract(chain, token);
      const addresses = this.contractAddresses[chain]!;

      const amountBN = ethers.parseUnits(amount, await tokenContract.decimals());

      const borrowParams: BorrowParams = {
        asset: addresses.tokens[token],
        amount: amountBN.toString(),
        interestRateMode,
        referralCode: 0,
        onBehalfOf: userAddress
      };

      const tx = await lendingPool.borrow(
        borrowParams.asset,
        borrowParams.amount,
        borrowParams.interestRateMode,
        borrowParams.referralCode,
        borrowParams.onBehalfOf
      );

      const receipt = await tx.wait();
      
      const transaction: ContractTransaction = {
        hash: tx.hash,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        confirmations: receipt.confirmations || 1,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Borrow transaction confirmed: ${tx.hash}`);
      return transaction;

    } catch (error) {
      console.error("Borrow transaction failed:", error);
      throw new Error(`Borrow failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Repay borrowed assets
   */
  async repay(
    chain: Chain,
    token: Token,
    amount: string,
    userAddress: string,
    rateMode: 1 | 2 = 2
  ): Promise<ContractTransaction> {
    try {
      console.log(`💳 Repaying ${amount} ${token} to ${chain} lending pool...`);

      const lendingPool = this.getLendingPoolContract(chain);
      const tokenContract = this.getTokenContract(chain, token);
      const addresses = this.contractAddresses[chain]!;

      // Check and approve tokens if needed
      const amountBN = ethers.parseUnits(amount, await tokenContract.decimals());
      const allowance = await tokenContract.allowance(userAddress, addresses.lendingPool);

      if (allowance < amountBN) {
        console.log("📝 Approving tokens for repayment...");
        const approveTx = await tokenContract.approve(addresses.lendingPool, amountBN);
        await approveTx.wait();
        console.log("✅ Token approval confirmed");
      }

      const repayParams: RepayParams = {
        asset: addresses.tokens[token],
        amount: amountBN.toString(),
        rateMode,
        onBehalfOf: userAddress
      };

      const tx = await lendingPool.repay(
        repayParams.asset,
        repayParams.amount,
        repayParams.rateMode,
        repayParams.onBehalfOf
      );

      const receipt = await tx.wait();
      
      const transaction: ContractTransaction = {
        hash: tx.hash,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        confirmations: receipt.confirmations || 1,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Repay transaction confirmed: ${tx.hash}`);
      return transaction;

    } catch (error) {
      console.error("Repay transaction failed:", error);
      throw new Error(`Repay failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user account data from lending pool
   */
  async getUserAccountData(chain: Chain, userAddress: string): Promise<{
    totalCollateralETH: string;
    totalDebtETH: string;
    availableBorrowsETH: string;
    currentLiquidationThreshold: string;
    ltv: string;
    healthFactor: string;
  }> {
    try {
      const lendingPool = this.getLendingPoolContract(chain);
      
      const accountData = await lendingPool.getUserAccountData(userAddress);
      
      return {
        totalCollateralETH: ethers.formatEther(accountData.totalCollateralETH),
        totalDebtETH: ethers.formatEther(accountData.totalDebtETH),
        availableBorrowsETH: ethers.formatEther(accountData.availableBorrowsETH),
        currentLiquidationThreshold: accountData.currentLiquidationThreshold.toString(),
        ltv: accountData.ltv.toString(),
        healthFactor: ethers.formatEther(accountData.healthFactor)
      };

    } catch (error) {
      console.error("Failed to get user account data:", error);
      throw error;
    }
  }

  /**
   * Get reserve data for an asset
   */
  async getReserveData(chain: Chain, token: Token): Promise<any> {
    try {
      const lendingPool = this.getLendingPoolContract(chain);
      const addresses = this.contractAddresses[chain]!;
      
      const reserveData = await lendingPool.getReserveData(addresses.tokens[token]);
      
      return {
        liquidityIndex: reserveData.liquidityIndex.toString(),
        variableBorrowIndex: reserveData.variableBorrowIndex.toString(),
        currentLiquidityRate: reserveData.currentLiquidityRate.toString(),
        currentVariableBorrowRate: reserveData.currentVariableBorrowRate.toString(),
        currentStableBorrowRate: reserveData.currentStableBorrowRate.toString(),
        lastUpdateTimestamp: reserveData.lastUpdateTimestamp.toString(),
        aTokenAddress: reserveData.aTokenAddress,
        stableDebtTokenAddress: reserveData.stableDebtTokenAddress,
        variableDebtTokenAddress: reserveData.variableDebtTokenAddress
      };

    } catch (error) {
      console.error("Failed to get reserve data:", error);
      throw error;
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    chain: Chain,
    operation: 'supply' | 'withdraw' | 'borrow' | 'repay',
    token: Token,
    amount: string,
    userAddress: string
  ): Promise<{ gasLimit: bigint; gasPrice: bigint; totalCost: string }> {
    try {
      const lendingPool = this.getLendingPoolContract(chain);
      const addresses = this.contractAddresses[chain]!;
      
      let gasEstimate: bigint;
      const gasPrice = await this.provider!.getFeeData();

      switch (operation) {
        case 'supply':
          gasEstimate = await lendingPool.deposit.estimateGas(
            addresses.tokens[token],
            ethers.parseUnits(amount, 18),
            userAddress,
            0
          );
          break;
        case 'withdraw':
          gasEstimate = await lendingPool.withdraw.estimateGas(
            addresses.tokens[token],
            ethers.parseUnits(amount, 18),
            userAddress
          );
          break;
        case 'borrow':
          gasEstimate = await lendingPool.borrow.estimateGas(
            addresses.tokens[token],
            ethers.parseUnits(amount, 18),
            2,
            0,
            userAddress
          );
          break;
        case 'repay':
          gasEstimate = await lendingPool.repay.estimateGas(
            addresses.tokens[token],
            ethers.parseUnits(amount, 18),
            2,
            userAddress
          );
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate * BigInt(120) / BigInt(100);
      const totalCost = ethers.formatEther(gasLimit * (gasPrice.gasPrice || BigInt(0)));

      return {
        gasLimit,
        gasPrice: gasPrice.gasPrice || BigInt(0),
        totalCost
      };

    } catch (error) {
      console.error("Gas estimation failed:", error);
      throw error;
    }
  }

  /**
   * Check if contracts are deployed on a chain
   */
  isDeployedOnChain(chain: Chain): boolean {
    return !!this.contractAddresses[chain]?.lendingPool;
  }

  /**
   * Get contract addresses for a chain
   */
  getContractAddresses(chain: Chain): ContractAddresses | null {
    return this.contractAddresses[chain];
  }
}

export const smartContractService = new SmartContractService();