import { ethers } from "https://esm.sh/ethers@6.13.2";

// TrezuryVault ABI
export const VAULT_ABI = [
  "constructor()",
  "function executeSwapWithEIP3009(address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s, address tokenIn, address tokenOut, uint24 fee, uint256 amountOutMinimum) returns (uint256)",
  "function executeSwapWithPermit(address from, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s, address tokenIn, address tokenOut, uint24 fee, uint256 amountOutMinimum) returns (uint256)",
  "function setTokenApproval(address token, bool approved)",
  "function withdrawFees(address token, uint256 amount, address recipient)",
  "function withdrawAllFees(address token, address recipient)",
  "function withdrawETH(address payable recipient, uint256 amount)",
  "function getVaultHealth() view returns (uint256 ethBalance, uint256 usdcFees, uint256 xautFees, uint256 wethFees, uint256 totalSwaps)",
  "function accumulatedFees(address token) view returns (uint256)",
  "function totalSwapsExecuted() view returns (uint256)",
  "function approvedTokens(address token) view returns (bool)",
  "function owner() view returns (address)",
  "event SwapExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 platformFee)",
  "event FeeWithdrawn(address indexed token, uint256 amount, address indexed recipient)",
  "event ETHDeposited(address indexed sender, uint256 amount)",
  "receive() external payable"
];

// Placeholder bytecode - replace with actual compiled bytecode
export const VAULT_BYTECODE = "0x608060405234801561001057600080fd5b50..."; // Full bytecode from compilation

/**
 * Deploy TrezuryVault contract
 */
export async function deployVault(
  deployerWallet: ethers.Wallet,
  provider: ethers.Provider
): Promise<{ address: string; txHash: string }> {
  console.log(`🚀 Deploying TrezuryVault contract...`);
  console.log(`   Deployer: ${deployerWallet.address}`);
  
  // Create contract factory
  const factory = new ethers.ContractFactory(
    VAULT_ABI,
    VAULT_BYTECODE,
    deployerWallet
  );
  
  // Deploy contract
  const vault = await factory.deploy();
  await vault.waitForDeployment();
  
  const address = await vault.getAddress();
  const deployTx = vault.deploymentTransaction();
  
  console.log(`✅ TrezuryVault deployed at: ${address}`);
  console.log(`   Deploy tx: ${deployTx?.hash}`);
  
  // Fund vault with initial ETH for gas (e.g., 1 ETH)
  console.log(`💰 Funding vault with 1 ETH for gas...`);
  const fundTx = await deployerWallet.sendTransaction({
    to: address,
    value: ethers.parseEther('1')
  });
  await fundTx.wait();
  console.log(`✅ Vault funded: ${fundTx.hash}`);
  
  // Approve additional tokens if needed
  const vaultContract = new ethers.Contract(address, VAULT_ABI, deployerWallet);
  
  // TRZRY token address (if deployed)
  const TRZRY = "0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B";
  
  console.log(`🔓 Approving TRZRY token...`);
  const approveTx = await vaultContract.setTokenApproval(TRZRY, true);
  await approveTx.wait();
  console.log(`✅ TRZRY approved`);
  
  return {
    address: address,
    txHash: deployTx!.hash
  };
}

/**
 * Get vault contract instance
 */
export function getVaultContract(
  vaultAddress: string,
  signerOrProvider: ethers.Wallet | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(vaultAddress, VAULT_ABI, signerOrProvider);
}

/**
 * Check vault health
 */
export async function checkVaultHealth(
  vaultAddress: string,
  provider: ethers.Provider
): Promise<{
  ethBalance: string;
  usdcFees: string;
  xautFees: string;
  wethFees: string;
  totalSwaps: number;
  isHealthy: boolean;
}> {
  const vault = getVaultContract(vaultAddress, provider);
  
  const [ethBalance, usdcFees, xautFees, wethFees, totalSwaps] = await vault.getVaultHealth();
  
  const ethBalanceEth = ethers.formatEther(ethBalance);
  const isHealthy = parseFloat(ethBalanceEth) > 0.1; // Alert if below 0.1 ETH
  
  return {
    ethBalance: ethBalanceEth,
    usdcFees: ethers.formatUnits(usdcFees, 6), // USDC has 6 decimals
    xautFees: ethers.formatUnits(xautFees, 6), // XAUT has 6 decimals
    wethFees: ethers.formatEther(wethFees),
    totalSwaps: Number(totalSwaps),
    isHealthy
  };
}
