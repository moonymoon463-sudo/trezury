/**
 * Simplified Swap Handler
 * Takes 0.8% platform fee from input token, uses infinite approval, user pays gas
 */

import { ethers } from "https://esm.sh/ethers@6.13.2";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)"
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)"
];

const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
}

const TOKEN_ADDRESSES: Record<string, TokenConfig> = {
  'ETH': { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
  'USDC': { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
  'XAUT': { address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', symbol: 'XAUt', decimals: 6 },
  'TRZRY': { address: '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B', symbol: 'TRZRY', decimals: 18 },
  'BTC': { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 }
};

/**
 * Check if token needs approval reset (USDT workaround)
 */
async function isUSDT(tokenAddress: string, provider: ethers.Provider): Promise<boolean> {
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  return tokenAddress.toLowerCase() === USDT_ADDRESS.toLowerCase();
}

/**
 * Check and set infinite approval if needed
 */
async function checkAndSetInfiniteApproval(
  wallet: ethers.Wallet,
  tokenAddress: string,
  spenderAddress: string,
  provider: ethers.Provider
): Promise<{ approved: boolean; isNew: boolean }> {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const currentAllowance = await token.allowance(wallet.address, spenderAddress);
  
  const MAX_UINT256 = ethers.MaxUint256;
  
  // Already has infinite approval
  if (currentAllowance >= MAX_UINT256 / 2n) {
    console.log(`✅ Infinite approval already exists`);
    return { approved: true, isNew: false };
  }
  
  // Special case for USDT: must reset to 0 first if non-zero
  if (currentAllowance > 0n && await isUSDT(tokenAddress, provider)) {
    console.log(`⚠️ USDT detected: resetting allowance to 0 first`);
    const resetTx = await token.connect(wallet).approve(spenderAddress, 0);
    await resetTx.wait();
  }
  
  // Set infinite approval
  console.log(`🔓 Setting infinite approval for ${tokenAddress}`);
  const approveTx = await token.connect(wallet).approve(spenderAddress, MAX_UINT256);
  await approveTx.wait();
  console.log(`✅ Infinite approval set`);
  
  return { approved: true, isNew: true };
}

/**
 * Execute simplified swap with input token fee
 */
export async function executeSimplifiedSwap(
  body: any,
  wallet: ethers.Wallet,
  provider: ethers.Provider
) {
  const {
    inputAsset,
    outputAsset,
    inputAmount,
    platformFee,
    platformFeeAsset,
    platformFeeWallet,
    netInputAmount,
    minOutputAmount,
    userAddress,
    route
  } = body;

  console.log(`[SimplifiedSwap] Starting swap: ${inputAmount} ${inputAsset} → ${outputAsset}`);
  console.log(`[SimplifiedSwap] Platform fee: ${platformFee} ${platformFeeAsset}`);
  console.log(`[SimplifiedSwap] Net input for swap: ${netInputAmount} ${inputAsset}`);

  // Get token configurations
  const inputToken = TOKEN_ADDRESSES[inputAsset];
  const outputToken = TOKEN_ADDRESSES[outputAsset];
  
  if (!inputToken || !outputToken) {
    throw new Error(`Unsupported asset: ${inputAsset} or ${outputAsset}`);
  }

  const inputTokenContract = new ethers.Contract(inputToken.address, ERC20_ABI, wallet);
  
  // STEP 1: Check/Set Infinite Approval
  console.log('[SimplifiedSwap] Step 1: Checking approval...');
  const approvalResult = await checkAndSetInfiniteApproval(
    wallet,
    inputToken.address,
    UNISWAP_V3_ROUTER,
    provider
  );
  
  const approvalStatus = approvalResult.isNew ? 'new' : 'existing';
  console.log(`[SimplifiedSwap] Approval status: ${approvalStatus}`);

  // STEP 2: Transfer platform fee to platform wallet
  if (platformFee > 0) {
    console.log(`[SimplifiedSwap] Step 2: Transferring platform fee...`);
    const feeAmount = ethers.parseUnits(platformFee.toString(), inputToken.decimals);
    const feeTx = await inputTokenContract.transfer(platformFeeWallet, feeAmount);
    const feeReceipt = await feeTx.wait();
    console.log(`✅ Platform fee collected: ${platformFee} ${platformFeeAsset} (tx: ${feeReceipt.hash})`);
  } else {
    console.log(`[SimplifiedSwap] No platform fee to collect`);
  }

  // STEP 3: Execute swap with NET input amount
  console.log(`[SimplifiedSwap] Step 3: Executing Uniswap swap...`);
  const swapRouter = new ethers.Contract(UNISWAP_V3_ROUTER, SWAP_ROUTER_ABI, wallet);
  
  const netAmount = ethers.parseUnits(netInputAmount.toString(), inputToken.decimals);
  const minOutput = ethers.parseUnits(minOutputAmount.toString(), outputToken.decimals);
  
  // Use route from DEX aggregator (multi-hop or direct)
  let swapTx: ethers.ContractTransactionResponse;
  
  if (route && route.path && route.path.length > 2) {
    // Multi-hop swap
    console.log(`[SimplifiedSwap] Using multi-hop route: ${route.path.join(' → ')}`);
    
    // Encode path for Uniswap V3
    const fees = route.fees || [3000]; // Default 0.3% pool fee
    let encodedPath = ethers.solidityPacked(
      ['address', 'uint24', 'address'],
      [inputToken.address, fees[0], outputToken.address]
    );
    
    const swapParams = {
      path: encodedPath,
      recipient: userAddress,
      deadline: Math.floor(Date.now() / 1000) + 1800, // 30 min
      amountIn: netAmount,
      amountOutMinimum: minOutput
    };
    
    swapTx = await swapRouter.exactInput(swapParams);
  } else {
    // Direct single-hop swap
    console.log(`[SimplifiedSwap] Using direct swap: ${inputAsset} → ${outputAsset}`);
    
    const swapParams = {
      tokenIn: inputToken.address,
      tokenOut: outputToken.address,
      fee: 3000, // 0.3% Uniswap pool fee
      recipient: userAddress,
      deadline: Math.floor(Date.now() / 1000) + 1800,
      amountIn: netAmount,
      amountOutMinimum: minOutput,
      sqrtPriceLimitX96: 0
    };
    
    swapTx = await swapRouter.exactInputSingle(swapParams);
  }
  
  console.log(`[SimplifiedSwap] Swap transaction sent: ${swapTx.hash}`);
  const receipt = await swapTx.wait();
  console.log(`✅ Swap completed: ${receipt.hash}`);
  
  // Calculate gas cost
  const gasUsed = receipt.gasUsed;
  const gasPrice = receipt.gasPrice || 0n;
  const gasCostEth = parseFloat(ethers.formatEther(gasUsed * gasPrice));
  
  return {
    success: true,
    txHash: receipt.hash,
    platformFeePaid: platformFee,
    platformFeeAsset: platformFeeAsset,
    netInputAmount: netInputAmount,
    approvalStatus,
    gasUsed: Number(gasUsed),
    gasCostEth,
    blockNumber: receipt.blockNumber
  };
}
