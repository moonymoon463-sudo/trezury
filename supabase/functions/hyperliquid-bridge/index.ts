import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ethers } from 'npm:ethers@6.13.0';

console.log('[hyperliquid-bridge] Function started');

// Across Protocol SpokePool contract addresses
const ACROSS_SPOKE_POOLS: Record<string, string> = {
  ethereum: '0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5',
  arbitrum: '0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A',
  optimism: '0x6f26Bf09B1C792e3228e5467807a900A503c0281',
  polygon: '0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096',
  base: '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64',
  bsc: '0x4e8E101924eDE233C13e2D8622DC8aED2872d505',
};

// Stargate Router contract addresses
const STARGATE_ROUTERS: Record<string, string> = {
  ethereum: '0x8731d54E9D02c286767d56ac03e8037C07e01e98',
  arbitrum: '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614',
  optimism: '0xB0D502E938ed5f4df2E681fE6E419ff29631d62b',
  polygon: '0x45A01E4e04F14f7A4a6702c74187c5F6222033cd',
  bsc: '0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8',
  avalanche: '0x45A01E4e04F14f7A4a6702c74187c5F6222033cd',
};

const USDC_ADDRESSES: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { operation, ...params } = await req.json();
    console.log(`[hyperliquid-bridge] Operation: ${operation}`, params);

    switch (operation) {
      case 'get_quote':
        return new Response(JSON.stringify(await getQuote(params)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      case 'execute_bridge':
        return new Response(JSON.stringify(await executeBridge(supabaseClient, user.id, params)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      case 'check_status':
        return new Response(JSON.stringify(await checkStatus(supabaseClient, params.bridgeId)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error('[hyperliquid-bridge] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getQuote(params: any) {
  const { fromChain, toChain, token, amount, provider, destinationAddress } = params;
  
  console.log('[hyperliquid-bridge] Getting quote:', { fromChain, toChain, amount, provider });

  const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  // Fee rates
  const feeRates: Record<string, number> = {
    across: 0.003, // 0.3%
    stargate: 0.002, // 0.2%
    wormhole: 0.001, // 0.1%
    native: 0.001 // 0.1%
  };

  const feeRate = feeRates[provider] || 0.003;
  const fee = parsedAmount * feeRate;
  const estimatedOutput = parsedAmount - fee;

  console.log('[hyperliquid-bridge] Fee calculation:', {
    parsedAmount,
    feeRate,
    fee,
    estimatedOutput
  });

  // Time estimates
  const timeEstimates: Record<string, Record<string, string>> = {
    across: {
      ethereum: '1 - 3min',
      arbitrum: '30s - 2min',
      default: '1 - 3min'
    },
    stargate: {
      ethereum: '2 - 5min',
      avalanche: '3 - 8min',
      polygon: '2 - 5min',
      bsc: '2 - 5min',
      default: '2 - 5min'
    },
    wormhole: {
      default: '5 - 15min'
    },
    native: {
      default: '5 - 10min'
    }
  };

  const estimatedTime = timeEstimates[provider]?.[fromChain] || timeEstimates[provider]?.default || '5 - 10min';

  // Gas cost estimates (in USD)
  const gasEstimates: Record<string, Record<string, string>> = {
    ethereum: { across: '$5-30', stargate: '$8-35' },
    arbitrum: { across: '$0.10-0.50', stargate: '$0.15-0.60' },
    optimism: { across: '$0.10-0.50', stargate: '$0.15-0.60' },
    polygon: { across: '$0.50-2', stargate: '$1-3' },
    base: { across: '$0.05-0.30', stargate: '$0.10-0.40' },
    bsc: { across: '$0.30-1', stargate: '$0.50-1.50' },
    avalanche: { stargate: '$1-3' },
  };

  const gasEstimate = gasEstimates[fromChain]?.[provider] || '$1-5';

  return {
    provider,
    fromChain,
    toChain,
    inputAmount: parsedAmount,
    estimatedOutput: Math.round(estimatedOutput * 100) / 100,
    fee: Math.round(fee * 100) / 100,
    estimatedTime,
    gasEstimate,
    route: {
      destinationAddress,
      token,
      confirmations: 1
    }
  };
}

async function executeBridge(supabaseClient: any, userId: string, params: any) {
  console.log('[executeBridge] Starting real bridge execution', { userId, params });

  try {
    const {
      quote,
      sourceWalletAddress,
      sourceWalletType,
      password,
    } = params;

    if (!quote || quote.toChain !== 'hyperliquid') {
      throw new Error('Invalid quote or destination chain');
    }

    let sourcePrivateKey: string | null = null;
    const destinationAddress = quote.route.destinationAddress;

    // Get private key for internal wallet
    if (sourceWalletType === 'internal') {
      if (!password) {
        throw new Error('Password required for internal wallet');
      }

      console.log('[executeBridge] Using internal wallet');

      // Get encrypted private key
      const { data: encryptedData, error: encryptError } = await supabaseClient
        .from('secure_wallets')
        .select('encrypted_private_key')
        .eq('user_id', userId)
        .single();

      if (encryptError || !encryptedData) {
        throw new Error('Wallet private key not found');
      }

      // Decrypt private key
      sourcePrivateKey = await decryptPrivateKey(encryptedData.encrypted_private_key, password);
      console.log('[executeBridge] Private key decrypted successfully');
    } else {
      throw new Error('External wallet bridging not yet supported. Please use internal wallet with password.');
    }

    // Record bridge transaction
    const bridgeRecord = {
      user_id: userId,
      source_chain: quote.fromChain,
      destination_chain: 'hyperliquid',
      bridge_provider: quote.provider,
      amount: quote.inputAmount,
      token: 'USDC',
      status: 'pending',
      estimated_completion: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      metadata: {
        quote,
        sourceWalletAddress,
        sourceWalletType,
        destinationAddress,
        estimatedOutput: quote.estimatedOutput,
        fee: quote.fee
      }
    };

    const { data: bridgeData, error: bridgeError } = await supabaseClient
      .from('bridge_transactions')
      .insert(bridgeRecord)
      .select()
      .single();

    if (bridgeError) {
      console.error('[executeBridge] Database error:', bridgeError);
      throw new Error(`Failed to record bridge transaction: ${bridgeError.message}`);
    }

    console.log('[executeBridge] Bridge transaction recorded:', bridgeData.id);

    // Execute bridge based on provider and chain
    const result = await executeBridgeTransaction(
      quote.provider,
      quote.fromChain,
      sourcePrivateKey,
      quote.inputAmount,
      destinationAddress,
      bridgeData.id,
      supabaseClient
    );

    return {
      success: true,
      bridgeId: bridgeData.id,
      txHash: result.txHash,
      estimatedCompletion: bridgeData.estimated_completion
    };
  } catch (error) {
    console.error('[executeBridge] Error:', error);
    throw error;
  }
}

async function decryptPrivateKey(encryptedKey: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const parts = encryptedKey.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }
  
  const [ivHex, saltHex, encryptedHex] = parts;
  const iv = hexToUint8Array(ivHex);
  const salt = hexToUint8Array(saltHex);
  const encrypted = hexToUint8Array(encryptedHex);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encrypted
  );
  
  return decoder.decode(decrypted);
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

async function executeAcrossBridge(
  sourceChain: string,
  privateKey: string,
  amount: number,
  destinationAddress: string,
  bridgeId: string,
  supabaseClient: any
) {
  console.log('[executeAcrossBridge] Starting Across bridge transaction', {
    sourceChain,
    amount,
    destinationAddress,
  });

  const rpcUrl = getRpcUrl(sourceChain);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('[executeAcrossBridge] Wallet address:', wallet.address);

  const spokePoolAddress = ACROSS_SPOKE_POOLS[sourceChain];
  const usdcAddress = USDC_ADDRESSES[sourceChain];

  if (!spokePoolAddress || !usdcAddress) {
    throw new Error(`Chain ${sourceChain} not supported for bridging`);
  }

  // USDC contract
  const usdcAbi = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];
  const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);

  // Check balance
  const decimals = await usdcContract.decimals();
  const amountWei = ethers.parseUnits(amount.toString(), decimals);
  const balance = await usdcContract.balanceOf(wallet.address);
  
  console.log('[executeAcrossBridge] Balance check:', {
    balance: ethers.formatUnits(balance, decimals),
    required: amount,
  });

  if (balance < amountWei) {
    throw new Error(`Insufficient USDC balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${amount}`);
  }

  // Check allowance
  const allowance = await usdcContract.allowance(wallet.address, spokePoolAddress);
  console.log('[executeAcrossBridge] Current allowance:', ethers.formatUnits(allowance, decimals));

  // Approve if needed
  if (allowance < amountWei) {
    console.log('[executeAcrossBridge] Approving USDC...');
    const approveTx = await usdcContract.approve(spokePoolAddress, amountWei);
    const approveReceipt = await approveTx.wait();
    console.log('[executeAcrossBridge] Approval confirmed:', approveTx.hash);

    await supabaseClient
      .from('bridge_transactions')
      .update({ approval_tx_hash: approveTx.hash })
      .eq('id', bridgeId);
  }

  // Execute bridge deposit via Across SpokePool
  const spokePoolAbi = [
    'function depositV3(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes calldata message) payable',
  ];
  const spokePool = new ethers.Contract(spokePoolAddress, spokePoolAbi, wallet);

  const quoteTimestamp = Math.floor(Date.now() / 1000);
  const fillDeadline = quoteTimestamp + 3600; // 1 hour
  const exclusivityDeadline = 0;
  const outputAmount = amountWei * BigInt(997) / BigInt(1000); // 0.3% fee

  console.log('[executeAcrossBridge] Executing deposit...');
  const depositTx = await spokePool.depositV3(
    wallet.address,
    destinationAddress,
    usdcAddress,
    usdcAddress,
    amountWei,
    outputAmount,
    42161, // Arbitrum as intermediate chain (Across will route to destination)
    ethers.ZeroAddress,
    quoteTimestamp,
    fillDeadline,
    exclusivityDeadline,
    '0x'
  );

  console.log('[executeAcrossBridge] Transaction submitted:', depositTx.hash);

  // Update database
  await supabaseClient
    .from('bridge_transactions')
    .update({ 
      status: 'processing',
      source_tx_hash: depositTx.hash 
    })
    .eq('id', bridgeId);

  // Wait for confirmation (background)
  depositTx.wait().then(async (receipt: any) => {
    console.log('[executeAcrossBridge] Transaction confirmed:', receipt.transactionHash);
    const gasCost = ethers.formatEther(receipt.gasUsed * receipt.gasPrice || 0);
    await supabaseClient
      .from('bridge_transactions')
      .update({ 
        status: 'completed',
        gas_cost: gasCost
      })
      .eq('id', bridgeId);
  }).catch(async (error: any) => {
    console.error('[executeAcrossBridge] Transaction failed:', error);
    await supabaseClient
      .from('bridge_transactions')
      .update({ 
        status: 'failed',
        error_message: error.message 
      })
      .eq('id', bridgeId);
  });

  return { txHash: depositTx.hash };
}

function getRpcUrl(chain: string): string {
  const infuraKey = Deno.env.get('INFURA_API_KEY');
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');

  switch (chain) {
    case 'ethereum':
      return `https://mainnet.infura.io/v3/${infuraKey}`;
    case 'arbitrum':
      return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 'optimism':
      return `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 'polygon':
      return `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 'base':
      return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    case 'bsc':
      return 'https://bsc-dataseed.bnbchain.org';
    case 'avalanche':
      return 'https://api.avax.network/ext/bc/C/rpc';
    default:
      throw new Error(`No RPC URL configured for chain: ${chain}`);
  }
}

async function executeBridgeTransaction(
  provider: string,
  sourceChain: string,
  privateKey: string,
  amount: number,
  destinationAddress: string,
  bridgeId: string,
  supabaseClient: any
) {
  console.log('[executeBridgeTransaction] Routing to provider:', provider, 'chain:', sourceChain);

  // Validate chain support
  const supportedChains: Record<string, string[]> = {
    across: ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'bsc'],
    stargate: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche'],
    wormhole: ['solana', 'ethereum', 'bsc', 'polygon', 'avalanche'],
    native: ['ethereum', 'arbitrum']
  };

  if (!supportedChains[provider]?.includes(sourceChain)) {
    throw new Error(`${provider} does not support ${sourceChain}. Supported chains: ${supportedChains[provider]?.join(', ')}`);
  }

  // Route to appropriate bridge provider
  switch (provider) {
    case 'across':
      return await executeAcrossBridge(sourceChain, privateKey, amount, destinationAddress, bridgeId, supabaseClient);
    
    case 'stargate':
      return await executeStargateBridge(sourceChain, privateKey, amount, destinationAddress, bridgeId, supabaseClient);
    
    case 'wormhole':
      if (sourceChain === 'solana') {
        throw new Error('Solana bridging via Wormhole is not yet implemented. Please use an EVM chain or contact support.');
      }
      return await executeWormholeBridge(sourceChain, privateKey, amount, destinationAddress, bridgeId, supabaseClient);
    
    case 'native':
      if (sourceChain === 'ethereum') {
        throw new Error('Native Arbitrum bridge is not yet implemented. Please use Across Protocol instead.');
      }
      throw new Error('Native bridge only supports Ethereum → Arbitrum');
    
    default:
      throw new Error(`Unknown bridge provider: ${provider}`);
  }
}

async function executeStargateBridge(
  sourceChain: string,
  privateKey: string,
  amount: number,
  destinationAddress: string,
  bridgeId: string,
  supabaseClient: any
) {
  console.log('[executeStargateBridge] Starting Stargate bridge from', sourceChain);

  const rpcUrl = getRpcUrl(sourceChain);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const routerAddress = STARGATE_ROUTERS[sourceChain];
  const usdcAddress = USDC_ADDRESSES[sourceChain];

  if (!routerAddress || !usdcAddress) {
    throw new Error(`Stargate not configured for ${sourceChain}`);
  }

  console.log('[executeStargateBridge] Using wallet:', wallet.address);

  // USDC contract
  const usdcAbi = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];
  const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);

  // Check balance
  const decimals = await usdcContract.decimals();
  const amountWei = ethers.parseUnits(amount.toString(), decimals);
  const balance = await usdcContract.balanceOf(wallet.address);

  console.log('[executeStargateBridge] Balance check:', {
    balance: ethers.formatUnits(balance, decimals),
    required: amount,
  });

  if (balance < amountWei) {
    throw new Error(`Insufficient USDC balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${amount}`);
  }

  // Check and approve
  const allowance = await usdcContract.allowance(wallet.address, routerAddress);
  console.log('[executeStargateBridge] Current allowance:', ethers.formatUnits(allowance, decimals));

  if (allowance < amountWei) {
    console.log('[executeStargateBridge] Approving USDC...');
    const approveTx = await usdcContract.approve(routerAddress, amountWei);
    const approveReceipt = await approveTx.wait();
    console.log('[executeStargateBridge] Approval confirmed:', approveTx.hash);
    
    await supabaseClient
      .from('bridge_transactions')
      .update({ approval_tx_hash: approveTx.hash })
      .eq('id', bridgeId);
  }

  // Stargate Router ABI
  const routerAbi = [
    'function swap(uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address payable _refundAddress, uint256 _amountLD, uint256 _minAmountLD, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes _to, bytes _payload) payable',
    'function quoteLayerZeroFee(uint16 _dstChainId, uint8 _functionType, bytes calldata _toAddress, bytes calldata _transferAndCallPayload, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) calldata _lzTxParams) view returns (uint256, uint256)',
  ];
  const router = new ethers.Contract(routerAddress, routerAbi, wallet);

  // LayerZero chain IDs for Stargate
  const layerZeroChainIds: Record<string, number> = {
    ethereum: 101,
    bsc: 102,
    avalanche: 106,
    polygon: 109,
    arbitrum: 110,
    optimism: 111,
  };

  // For Hyperliquid, we bridge to Arbitrum as intermediate destination
  const dstChainId = layerZeroChainIds.arbitrum || 110;
  const srcPoolId = 1; // USDC pool ID
  const dstPoolId = 1; // USDC pool ID on destination

  // Calculate minimum amount out (0.2% slippage)
  const minAmountOut = (amountWei * BigInt(998)) / BigInt(1000);

  // Encode destination address for LayerZero
  const destinationAddressBytes = ethers.solidityPacked(['address'], [destinationAddress]);

  // LayerZero transaction parameters
  const lzTxParams = {
    dstGasForCall: 0, // No contract call on destination
    dstNativeAmount: 0, // No native token airdrop
    dstNativeAddr: '0x' // No airdrop address
  };

  // Quote LayerZero fees
  console.log('[executeStargateBridge] Quoting LayerZero fees...');
  let layerZeroFee;
  try {
    const [nativeFee, zroFee] = await router.quoteLayerZeroFee(
      dstChainId,
      1, // TYPE_SWAP_REMOTE
      destinationAddressBytes,
      '0x',
      lzTxParams
    );
    layerZeroFee = nativeFee;
    console.log('[executeStargateBridge] LayerZero fee:', ethers.formatEther(nativeFee));
  } catch (error) {
    console.log('[executeStargateBridge] Failed to quote fee, using estimate');
    // Fallback fee estimate based on chain
    const feeEstimates: Record<string, string> = {
      ethereum: '0.005',
      arbitrum: '0.001',
      optimism: '0.001',
      polygon: '0.01',
      bsc: '0.005',
      avalanche: '0.05',
    };
    layerZeroFee = ethers.parseEther(feeEstimates[sourceChain] || '0.01');
  }

  // Check native balance for LayerZero fee
  const nativeBalance = await provider.getBalance(wallet.address);
  console.log('[executeStargateBridge] Native balance:', ethers.formatEther(nativeBalance));

  if (nativeBalance < layerZeroFee) {
    throw new Error(`Insufficient native token for LayerZero fee. Need: ${ethers.formatEther(layerZeroFee)}, Have: ${ethers.formatEther(nativeBalance)}`);
  }

  console.log('[executeStargateBridge] Executing Stargate swap...', {
    dstChainId,
    srcPoolId,
    dstPoolId,
    amount: ethers.formatUnits(amountWei, decimals),
    minAmountOut: ethers.formatUnits(minAmountOut, decimals),
    layerZeroFee: ethers.formatEther(layerZeroFee),
  });

  // Execute swap
  const swapTx = await router.swap(
    dstChainId,
    srcPoolId,
    dstPoolId,
    wallet.address, // refund address
    amountWei,
    minAmountOut,
    lzTxParams,
    destinationAddressBytes,
    '0x', // no payload
    { value: layerZeroFee }
  );

  console.log('[executeStargateBridge] Transaction submitted:', swapTx.hash);

  // Update database
  await supabaseClient
    .from('bridge_transactions')
    .update({ 
      status: 'processing',
      source_tx_hash: swapTx.hash 
    })
    .eq('id', bridgeId);

  // Wait for confirmation (background)
  swapTx.wait().then(async (receipt: any) => {
    console.log('[executeStargateBridge] Transaction confirmed:', receipt.transactionHash);
    const gasCost = ethers.formatEther(receipt.gasUsed * receipt.gasPrice || 0);
    await supabaseClient
      .from('bridge_transactions')
      .update({ 
        status: 'completed',
        gas_cost: gasCost
      })
      .eq('id', bridgeId);
  }).catch(async (error: any) => {
    console.error('[executeStargateBridge] Transaction failed:', error);
    await supabaseClient
      .from('bridge_transactions')
      .update({ 
        status: 'failed',
        error_message: error.message 
      })
      .eq('id', bridgeId);
  });

  return { txHash: swapTx.hash };
}

async function executeWormholeBridge(
  sourceChain: string,
  privateKey: string,
  amount: number,
  destinationAddress: string,
  bridgeId: string,
  supabaseClient: any
) {
  console.log('[executeWormholeBridge] Wormhole bridge not yet implemented');
  throw new Error('Wormhole bridge is not yet implemented. Please use Across Protocol or Stargate for supported chains.');
}

async function checkStatus(supabaseClient: any, bridgeId: string) {
  const { data: bridge, error } = await supabaseClient
    .from('bridge_transactions')
    .select('*')
    .eq('id', bridgeId)
    .single();

  if (error) throw error;

  return {
    status: bridge.status,
    txHash: bridge.source_tx_hash,
    destinationTxHash: bridge.destination_tx_hash,
    estimatedCompletion: bridge.estimated_completion,
    amount: bridge.amount,
    error: bridge.error_message
  };
}