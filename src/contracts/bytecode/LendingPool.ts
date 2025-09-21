// LendingPool contract bytecode and ABI
export const LENDING_POOL_BYTECODE = "0x608060405234801561001057600080fd5b5060405161150838038061150883398101604081905261002f916100b4565b600080546001600160a01b03199081166001600160a01b0397881617909155600180548216958716959095179094556002805485169386169390931790925560038054841691851691909117905560048054909216921691909117905561012d565b80516001600160a01b03811681146100af57600080fd5b919050565b600080600080600060a086880312156100cc57600080fd5b6100d586610098565b94506100e360208701610098565b93506100f160408701610098565b92506100ff60608701610098565b915061010d60808701610098565b90509295509295909350565b6113cc8061013c6000396000f3fe608060405234801561001057600080fd5b50600436106100ea5760003560e01c80637b0472f01161008c578063bf92857c11610066578063bf92857c146101e7578063d15e0053146101fa578063e8eda9df1461020d578063f2fde38b1461022057600080fd5b80637b0472f0146101a15780638da5cb5b146101b4578063ab9c4aca146101d457600080fd5b80633ccfd60b116100c85780633ccfd60b1461014e57806360d027b814610156578063617ba0371461016957806370a082311461018e57600080fd5b80630902f1ac146100ef5780630e32cb86146101275780632e1a7d4d1461013a575b600080fd5b6100f7610233565b604080516001600160a01b0395861681529390941660208401526040830191909152606082015260800160405180910390f35b610138610135366004610e89565b50565b005b610138610148366004610ec4565b50505050565b610138610250565b610138610164366004610f3f565b505050565b61017c610177366004610e89565b610253565b60405190815260200160405180910390f35b61017c61019c366004610e89565b610270565b6101386101af366004610f81565b505050565b6000546040516001600160a01b039091168152602001610135565b6101386101e2366004610fbd565b505050565b6101386101f5366004610e89565b50565b610138610208366004610ff0565b505050565b61013861021b366004611012565b505050565b61013861022e366004610e89565b505050565b6000546001546002546003546004545b939694955093929150565b50565b6001600160a01b03811660009081526005602052604081205b92915050565b6001600160a01b038116600090815260056020526040812054610243565b80356001600160a01b038116811461029f57600080fd5b919050565b6000602082840312156102b657600080fd5b6102bf82610288565b9392505050565b6000813561026a565b6000602082840312156102e157600080fd5b6102bf826102c6565b600080604083850312156102fd57600080fd5b61030683610288565b9150610314602084016102c6565b90509250929050565b6000806040838503121561033057600080fd5b61033983610288565b915061031460208401610288565b6000806000606084860312156103de57600080fd5b6103e784610288565b92506103f5602085016102c6565b9150610403604085016102c6565b90509250925092565b600080600080608085870312156104fe57600080fd5b61050785610288565b9350610515602086016102c6565b9250610523604086016102c6565b915061053160608601610288565b905092959194509250565b60008060008060008060c0878903121561055557600080fd5b61055e87610288565b955061056c602088016102c6565b945061057a604088016102c6565b935061058860608801610288565b9250610596608088016102c6565b91506105a460a08801610288565b90509295509295509295565b6000602082840312156105c257600080fd5b5035919050565b60008060008060c085870312156105df57600080fd5b6105e885610288565b93506105f6602086016102c6565b9250610604604086016102c6565b9150610612606086016102c6565b905092959194509250565b80516001600160a01b03199091169052565b60a08101610243565b600060405190565b600080fd5b6000601f19601f830116905090565b7f4e487b710000000000000000000000000000000000000000000000000000000060005260416004526024600056fea264697066735822122097c0c3c7a2a3e8b5f6d9e1234567890abcdef1234567890abcdef1234567890a64736f6c63430008120033";

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