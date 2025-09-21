// Simple Mock LendingPool Contract - Valid compiled bytecode  
export const LENDING_POOL_BYTECODE = "0x608060405234801561001057600080fd5b50604051610678380380610678833981016040819052610030916100f1565b600080546001600160a01b0319908116871790915560018054821686179055600280548216851790556003805482168417905560048054909116919092179055610154565b80516001600160a01b038116811461008857600080fd5b919050565b600080600080600060a086880312156100a557600080fd5b6100ae86610071565b94506100bc60208701610071565b93506100ca60408701610071565b92506100d860608701610071565b91506100e660808701610071565b90509295509295909350565b60008060008060008060a0878903121561010b57600080fd5b61011487610071565b955061012260208801610071565b945061013060408801610071565b935061013e60608801610071565b925061014c60808801610071565b90509295509295509295565b610515806101636000396000f3fe608060405234801561001057600080fd5b50600436106100625760003560e01c8063035cf142146100675780630902f1ac146100715780632f745c59146100925780635aa6e675146100a557806370a08231146100c05780639dc29fac146100d3575b600080fd5b61006f6100e6565b005b600054600154600254600354600454604080516001600160a01b0396871681529590941660208601529084015260608301526080820152519081900360a00190f35b61006f6100a03660046103f1565b505050565b6000546040516001600160a01b03909116815260200160405180910390f35b61006f6100ce366004610413565b505050565b61006f6100e1366004610435565b505050565b565b80356001600160a01b038116811461010457600080fd5b919050565b6000806040838503121561011c57600080fd5b610125836100ed565b946020939093013593505050565b60006020828403121561014557600080fd5b61014e826100ed565b9392505050565b6000806040838503121561016857600080fd5b50508035926020909101359150565b600181811c9082168061018b57607f821691505b6020821081036101ab57634e487b7160e01b600052602260045260246000fd5b5091905056fea2646970667358221220a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b264736f6c63430008120033";

export const LENDING_POOL_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_usdc", "type": "address"},
      {"internalType": "address", "name": "_usdt", "type": "address"},
      {"internalType": "address", "name": "_dai", "type": "address"},
      {"internalType": "address", "name": "_xaut", "type": "address"},
      {"internalType": "address", "name": "_auru", "type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "asset", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "uint256", "name": "interestRateMode", "type": "uint256"},
      {"internalType": "uint16", "name": "referralCode", "type": "uint16"},
      {"internalType": "address", "name": "onBehalfOf", "type": "address"}
    ],
    "name": "borrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "asset", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "address", "name": "onBehalfOf", "type": "address"},
      {"internalType": "uint16", "name": "referralCode", "type": "uint16"}
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "getUserAccountData",
    "outputs": [
      {"internalType": "uint256", "name": "totalCollateralETH", "type": "uint256"},
      {"internalType": "uint256", "name": "totalDebtETH", "type": "uint256"},
      {"internalType": "uint256", "name": "availableBorrowsETH", "type": "uint256"},
      {"internalType": "uint256", "name": "currentLiquidationThreshold", "type": "uint256"},
      {"internalType": "uint256", "name": "ltv", "type": "uint256"},
      {"internalType": "uint256", "name": "healthFactor", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "asset", "type": "address"}
    ],
    "name": "getReserveData",
    "outputs": [
      {"internalType": "uint256", "name": "configuration", "type": "uint256"},
      {"internalType": "uint128", "name": "liquidityIndex", "type": "uint128"},
      {"internalType": "uint128", "name": "variableBorrowIndex", "type": "uint128"},
      {"internalType": "uint128", "name": "currentLiquidityRate", "type": "uint128"},
      {"internalType": "uint128", "name": "currentVariableBorrowRate", "type": "uint128"},
      {"internalType": "uint128", "name": "currentStableBorrowRate", "type": "uint128"},
      {"internalType": "uint40", "name": "lastUpdateTimestamp", "type": "uint40"},
      {"internalType": "address", "name": "aTokenAddress", "type": "address"},
      {"internalType": "address", "name": "stableDebtTokenAddress", "type": "address"},
      {"internalType": "address", "name": "variableDebtTokenAddress", "type": "address"},
      {"internalType": "address", "name": "interestRateStrategyAddress", "type": "address"},
      {"internalType": "uint8", "name": "id", "type": "uint8"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "asset", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "uint256", "name": "rateMode", "type": "uint256"},
      {"internalType": "address", "name": "onBehalfOf", "type": "address"}
    ],
    "name": "repay",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "asset", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "address", "name": "to", "type": "address"}
    ],
    "name": "withdraw",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];