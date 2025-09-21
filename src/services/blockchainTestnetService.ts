// COMPATIBILITY STUB - prevents import errors
// This service has been replaced by the clean wallet system

export const blockchainTestnetService = {
  getTestnetFaucets: () => ({
    ETH: "https://sepoliafaucet.com/",
    USDC: "https://faucets.chain.link/sepolia",
    general: "https://faucets.chain.link/sepolia"
  }),
  
  getNetworkInfo: () => ({
    name: "Sepolia Testnet",
    chainId: 11155111,
    rpcUrl: "https://sepolia.infura.io/v3/...",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: {
      name: "SepoliaETH",
      symbol: "ETH",
      decimals: 18
    }
  }),
  
  isValidAddress: (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
};