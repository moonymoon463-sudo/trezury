import { Chain, Token } from "@/types/lending";

// Smart contract configuration interface
export interface ContractConfig {
  lendingPoolAddress: string;
  addressesProviderAddress: string;
  priceOracleAddress: string;
  interestRateStrategyAddress: string;
  tokens: Record<Token, TokenConfig>;
  aTokens: Record<Token, string>;
  variableDebtTokens: Record<Token, string>;
}

export interface TokenConfig {
  address: string;
  decimals: number;
  ltv: number; // Loan-to-Value ratio (0-10000, where 8000 = 80%)
  liquidationThreshold: number; // (0-10000, where 8500 = 85%)
  liquidationBonus: number; // (0-10000, where 500 = 5%)
  reserveFactor: number; // (0-10000, where 1000 = 10%)
  usageAsCollateralEnabled: boolean;
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
}

// Network configuration for different chains
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Default contract configurations for each supported chain
export const NETWORK_CONFIGS: Record<Chain, NetworkConfig> = {
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    }
  },
  base: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    }
  },
  solana: {
    chainId: 101,
    name: "Solana Mainnet",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    blockExplorer: "https://explorer.solana.com",
    nativeCurrency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9
    }
  },
  tron: {
    chainId: 728126428,
    name: "Tron Mainnet",
    rpcUrl: "https://api.trongrid.io",
    blockExplorer: "https://tronscan.org",
    nativeCurrency: {
      name: "Tronix",
      symbol: "TRX",
      decimals: 6
    }
  }
};

// Default token configurations with risk parameters
export const DEFAULT_TOKEN_CONFIGS: Record<Token, Omit<TokenConfig, 'address'>> = {
  USDC: {
    decimals: 6,
    ltv: 8000, // 80%
    liquidationThreshold: 8500, // 85%
    liquidationBonus: 500, // 5%
    reserveFactor: 1000, // 10%
    usageAsCollateralEnabled: true,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true
  },
  USDT: {
    decimals: 6,
    ltv: 8000, // 80%
    liquidationThreshold: 8500, // 85%
    liquidationBonus: 500, // 5%
    reserveFactor: 1000, // 10%
    usageAsCollateralEnabled: true,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true
  },
  DAI: {
    decimals: 18,
    ltv: 8000, // 80%
    liquidationThreshold: 8500, // 85%
    liquidationBonus: 500, // 5%
    reserveFactor: 1000, // 10%
    usageAsCollateralEnabled: true,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true
  },
  XAUT: {
    decimals: 6,
    ltv: 7000, // 70% (lower due to volatility)
    liquidationThreshold: 7500, // 75%
    liquidationBonus: 1000, // 10%
    reserveFactor: 2000, // 20%
    usageAsCollateralEnabled: true,
    borrowingEnabled: true,
    stableBorrowRateEnabled: false
  },
  AURU: {
    decimals: 18,
    ltv: 5000, // 50% (governance token - conservative)
    liquidationThreshold: 6000, // 60%
    liquidationBonus: 1500, // 15%
    reserveFactor: 3000, // 30%
    usageAsCollateralEnabled: true,
    borrowingEnabled: false, // Governance token not borrowable
    stableBorrowRateEnabled: false
  }
};

// Interest rate model parameters
export interface InterestRateParams {
  baseVariableBorrowRate: number; // 2% = 0.02
  variableRateSlope1: number; // 5% = 0.05  
  variableRateSlope2: number; // 100% = 1.0
  stableRateSlope1: number; // 2% = 0.02
  stableRateSlope2: number; // 75% = 0.75
  baseStableBorrowRate: number; // 4% = 0.04
  optimalUtilizationRate: number; // 80% = 0.80
}

export const DEFAULT_INTEREST_RATE_PARAMS: Record<Token, InterestRateParams> = {
  USDC: {
    baseVariableBorrowRate: 0.02,
    variableRateSlope1: 0.05,
    variableRateSlope2: 1.0,
    stableRateSlope1: 0.02,
    stableRateSlope2: 0.75,
    baseStableBorrowRate: 0.04,
    optimalUtilizationRate: 0.80
  },
  USDT: {
    baseVariableBorrowRate: 0.02,
    variableRateSlope1: 0.05,
    variableRateSlope2: 1.0,
    stableRateSlope1: 0.02,
    stableRateSlope2: 0.75,
    baseStableBorrowRate: 0.04,
    optimalUtilizationRate: 0.80
  },
  DAI: {
    baseVariableBorrowRate: 0.02,
    variableRateSlope1: 0.05,
    variableRateSlope2: 1.0,
    stableRateSlope1: 0.02,
    stableRateSlope2: 0.75,
    baseStableBorrowRate: 0.04,
    optimalUtilizationRate: 0.80
  },
  XAUT: {
    baseVariableBorrowRate: 0.04,
    variableRateSlope1: 0.08,
    variableRateSlope2: 1.5,
    stableRateSlope1: 0.04,
    stableRateSlope2: 1.0,
    baseStableBorrowRate: 0.06,
    optimalUtilizationRate: 0.70
  },
  AURU: {
    baseVariableBorrowRate: 0.08,
    variableRateSlope1: 0.15,
    variableRateSlope2: 2.0,
    stableRateSlope1: 0.08,
    stableRateSlope2: 1.5,
    baseStableBorrowRate: 0.10,
    optimalUtilizationRate: 0.50
  }
};

// Protocol configuration
export const PROTOCOL_CONFIG = {
  MAX_STABLE_RATE_BORROW_SIZE_PERCENT: 25, // 25% of total borrows can be stable rate
  FLASHLOAN_PREMIUM_TOTAL: 9, // 0.09%
  MAX_RESERVES_COUNT: 128,
  HEALTH_FACTOR_LIQUIDATION_THRESHOLD: 1000000000000000000n // 1.0 in ray (27 decimals)
};

// Gas limits for different operations
export const GAS_LIMITS = {
  DEPOSIT: 300000,
  WITHDRAW: 300000,
  BORROW: 400000,
  REPAY: 300000,
  LIQUIDATION_CALL: 500000,
  SET_USER_USE_RESERVE_AS_COLLATERAL: 200000,
  FLASHLOAN: 800000
};

// Gas price configurations (in gwei)
export const GAS_CONFIGS = {
  SLOW: 10,
  STANDARD: 20,
  FAST: 30,
  INSTANT: 50
};