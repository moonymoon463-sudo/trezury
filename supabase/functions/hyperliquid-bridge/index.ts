import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ethers } from 'npm:ethers@6.13.0';
import {
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  getEmitterAddressEth,
  parseSequenceFromLogEth,
  tryNativeToHexString,
} from 'npm:@certusone/wormhole-sdk@latest';
import { retryWithBackoff, wrapError, NonRetryableError } from '../_shared/bridgeRetry.ts';
import { fetchVAA, parseSequenceFromReceipt } from '../_shared/wormholeVAA.ts';

console.log('[hyperliquid-bridge] Function started');

// Validate required environment variables on startup
const REQUIRED_SECRETS = ['INFURA_API_KEY', 'WALLET_ENCRYPTION_KEY'];
const missingSecrets = REQUIRED_SECRETS.filter(key => !Deno.env.get(key));
if (missingSecrets.length > 0) {
  console.error('[hyperliquid-bridge] Missing required secrets:', missingSecrets);
}

// Transaction limits per chain (in USDC)
const BRIDGE_LIMITS: Record<string, { min: number; max: number }> = {
  ethereum: { min: 10, max: 100000 },
  arbitrum: { min: 10, max: 100000 },
  optimism: { min: 10, max: 100000 },
  polygon: { min: 10, max: 50000 },
  base: { min: 10, max: 50000 },
  bsc: { min: 10, max: 50000 },
  avalanche: { min: 10, max: 50000 },
};

// Transaction timeout (30 minutes)
const TRANSACTION_TIMEOUT_MS = 30 * 60 * 1000;

// Across Protocol SpokePool contract addresses
const ACROSS_SPOKE_POOLS: Record<string, string> = {
  ethereum: '0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5',
  arbitrum: '0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A',
  optimism: '0x6f26Bf09B1C792e3228e5467807a900A503c0281',
  polygon: '0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096',
  base: '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64',
  bsc: '0x4e8E101924eDE233C13e2D8622DC8aED2872d505',
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

// Wormhole Token Bridge contract addresses
const WORMHOLE_TOKEN_BRIDGES: Record<string, string> = {
  ethereum: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
  bsc: '0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7',
  polygon: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
  avalanche: '0x0e082F06FF657D94310cB8cE8B0D9a04541d8052',
  arbitrum: '0x0b2402144Bb366A632D14B83F244D2e0e21bD39c',
};

// Wormhole chain IDs
const WORMHOLE_CHAIN_IDS: Record<string, number> = {
  ethereum: CHAIN_ID_ETH,
  bsc: CHAIN_ID_BSC,
  polygon: CHAIN_ID_POLYGON,
  avalanche: CHAIN_ID_AVAX,
  arbitrum: CHAIN_ID_ARBITRUM,
  solana: CHAIN_ID_SOLANA,
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
    // Validate API keys are configured
    const infuraKey = Deno.env.get('INFURA_API_KEY');
    const encryptionKey = Deno.env.get('WALLET_ENCRYPTION_KEY');
    
    if (!infuraKey || !encryptionKey) {
      throw new Error('Bridge service is not properly configured. Missing required API keys.');
    }

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
  
  // Validate amount
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new NonRetryableError(`Invalid amount: ${amount}`);
  }

  // Validate address format
  if (!destinationAddress || !/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
    throw new NonRetryableError('Invalid destination address format');
  }

  // Check transaction limits
  const limits = BRIDGE_LIMITS[fromChain];
  if (!limits) {
    throw new NonRetryableError(`Unsupported chain: ${fromChain}`);
  }

  if (parsedAmount < limits.min) {
    throw new NonRetryableError(`Minimum bridge amount for ${fromChain} is ${limits.min} USDC`);
  }

  if (parsedAmount > limits.max) {
    throw new NonRetryableError(`Maximum bridge amount for ${fromChain} is ${limits.max} USDC`);
  }

  // Fee rates
  const feeRates: Record<string, number> = {
    across: 0.003, // 0.3%
    wormhole: 0.001 // 0.1%
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
    wormhole: {
      avalanche: '5 - 15min',
      ethereum: '10 - 20min',
      bsc: '5 - 15min',
      polygon: '5 - 15min',
      default: '5 - 15min'
    }
  };

  const estimatedTime = timeEstimates[provider]?.[fromChain] || timeEstimates[provider]?.default || '5 - 10min';

  // Gas cost estimates (in USD)
  const gasEstimates: Record<string, Record<string, string>> = {
    ethereum: { across: '$5-30', wormhole: '$8-40' },
    arbitrum: { across: '$0.10-0.50', wormhole: '$0.15-0.60' },
    optimism: { across: '$0.10-0.50', wormhole: '$0.15-0.60' },
    polygon: { across: '$0.50-2', wormhole: '$1-3' },
    base: { across: '$0.05-0.30' },
    bsc: { across: '$0.30-1', wormhole: '$0.50-1.50' },
    avalanche: { wormhole: '$1-4' },
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
  console.log('[executeBridge] Starting bridge execution', { userId, params });

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

    // Handle external wallets - return unsigned transaction data
    if (sourceWalletType === 'external') {
      return await prepareExternalWalletBridge(supabaseClient, userId, quote, sourceWalletAddress);
    }

    // Internal wallet flow
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
    const sourcePrivateKey = await decryptPrivateKey(encryptedData.encrypted_private_key, password);
    console.log('[executeBridge] Private key decrypted successfully');

    const destinationAddress = quote.route.destinationAddress;

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
        fee: quote.fee,
        note: 'Funds will arrive on Arbitrum. Use Hyperliquid official bridge to complete transfer.'
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
      estimatedCompletion: bridgeData.estimated_completion,
      note: 'Funds will arrive on Arbitrum. You must then use Hyperliquid official bridge to complete transfer.'
    };
  } catch (error) {
    console.error('[executeBridge] Error:', error);
    throw error;
  }
}

// Prepare unsigned transaction for external wallet
async function prepareExternalWalletBridge(
  supabaseClient: any,
  userId: string,
  quote: any,
  sourceWalletAddress: string
) {
  console.log('[prepareExternalWalletBridge] Preparing transaction for external wallet');
  
  // Create bridge record
  const { data: bridgeRecord, error: insertError } = await supabaseClient
    .from('bridge_transactions')
    .insert({
      user_id: userId,
      bridge_provider: quote.provider,
      source_chain: quote.fromChain,
      destination_chain: quote.toChain,
      amount: quote.inputAmount,
      status: 'awaiting_signature',
      metadata: {
        estimatedFee: quote.fee,
        estimatedOutput: quote.estimatedOutput,
        sourceWalletAddress,
        externalWallet: true,
        note: 'Funds will arrive on Arbitrum. Use Hyperliquid official bridge to complete transfer.'
      },
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Prepare transaction data based on provider
  let unsignedTx;
  if (quote.provider === 'across') {
    unsignedTx = await prepareAcrossTransaction(quote, sourceWalletAddress);
  } else if (quote.provider === 'wormhole') {
    unsignedTx = await prepareWormholeTransaction(quote, sourceWalletAddress);
  } else {
    throw new Error(`Unsupported bridge provider: ${quote.provider}`);
  }

  return {
    success: true,
    bridgeId: bridgeRecord.id,
    requiresSignature: true,
    unsignedTransaction: unsignedTx,
    message: 'Please sign the transaction in your wallet',
    note: 'Funds will arrive on Arbitrum. You must then use Hyperliquid official bridge to complete transfer.'
  };
}

// Prepare Across transaction for external signing
async function prepareAcrossTransaction(quote: any, fromAddress: string) {
  const spokePoolAddress = ACROSS_SPOKE_POOLS[quote.fromChain];
  const usdcAddress = USDC_ADDRESSES[quote.fromChain];
  
  if (!spokePoolAddress || !usdcAddress) {
    throw new Error(`Across not supported on ${quote.fromChain}`);
  }

  const amount = ethers.parseUnits(quote.inputAmount.toString(), 6);
  
  // Return approval and deposit transactions
  return {
    approval: {
      to: usdcAddress,
      from: fromAddress,
      data: new ethers.Interface(['function approve(address spender, uint256 amount)']).encodeFunctionData('approve', [spokePoolAddress, amount]),
      value: '0x0',
    },
    deposit: {
      to: spokePoolAddress,
      from: fromAddress,
      data: new ethers.Interface([
        'function depositV3(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes message) payable'
      ]).encodeFunctionData('depositV3', [
        fromAddress,
        fromAddress,
        usdcAddress,
        usdcAddress,
        amount,
        amount,
        42161, // Arbitrum as intermediate chain
        ethers.ZeroAddress,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000) + 3600,
        0,
        '0x',
      ]),
      value: '0x0',
    },
  };
}

// Prepare Wormhole transaction for external signing
async function prepareWormholeTransaction(quote: any, fromAddress: string) {
  const tokenBridgeAddress = WORMHOLE_TOKEN_BRIDGES[quote.fromChain];
  const usdcAddress = USDC_ADDRESSES[quote.fromChain];
  
  if (!tokenBridgeAddress || !usdcAddress) {
    throw new Error(`Wormhole not supported on ${quote.fromChain}`);
  }

  const amount = ethers.parseUnits(quote.inputAmount.toString(), 6);
  
  return {
    approval: {
      to: usdcAddress,
      from: fromAddress,
      data: new ethers.Interface(['function approve(address spender, uint256 amount)']).encodeFunctionData('approve', [tokenBridgeAddress, amount]),
      value: '0x0',
    },
    transfer: {
      to: tokenBridgeAddress,
      from: fromAddress,
      data: new ethers.Interface([
        'function transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64 sequence)'
      ]).encodeFunctionData('transferTokens', [
        usdcAddress,
        amount,
        CHAIN_ID_ARBITRUM, // Arbitrum as intermediate
        ethers.zeroPadValue(fromAddress, 32),
        0,
        Math.floor(Math.random() * 4294967295),
      ]),
      value: ethers.parseEther('0.001').toString(), // Wormhole fee
    },
  };
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
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
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

  // Check balance with retry
  const decimals = await retryWithBackoff(() => usdcContract.decimals(), { maxRetries: 2 });
  const amountWei = ethers.parseUnits(amount.toString(), decimals);
  const balance = await retryWithBackoff(() => usdcContract.balanceOf(wallet.address), { maxRetries: 2 });
  
  console.log('[executeAcrossBridge] Balance check:', {
    balance: ethers.formatUnits(balance, decimals),
    required: amount,
  });

  if (balance < amountWei) {
    throw new NonRetryableError(`Insufficient USDC balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${amount}`);
  }

  // Check allowance
  const allowance = await usdcContract.allowance(wallet.address, spokePoolAddress);
  console.log('[executeAcrossBridge] Current allowance:', ethers.formatUnits(allowance, decimals));

  // Approve if needed with retry and timeout
  if (allowance < amountWei) {
    console.log('[executeAcrossBridge] Approving USDC...');
    
    const approveTx = await retryWithBackoff(
      () => usdcContract.approve(spokePoolAddress, amountWei),
      { maxRetries: 3 }
    );
    
    console.log('[executeAcrossBridge] Approval tx:', approveTx.hash);

    await supabaseClient
      .from('bridge_transactions')
      .update({ approval_tx_hash: approveTx.hash })
      .eq('id', bridgeId);

    // Wait with timeout
    await Promise.race([
      approveTx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Approval timeout')), TRANSACTION_TIMEOUT_MS)
      )
    ]);
    
    console.log('[executeAcrossBridge] Approval confirmed');
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
  
  const depositTx = await retryWithBackoff(
    () => spokePool.depositV3(
      wallet.address,
      destinationAddress,
      usdcAddress,
      usdcAddress,
      amountWei,
      outputAmount,
      42161, // Arbitrum as intermediate chain - users must then use Hyperliquid bridge
      ethers.ZeroAddress,
      quoteTimestamp,
      fillDeadline,
      exclusivityDeadline,
      '0x'
    ),
    { maxRetries: 3 },
    (attempt, error) => {
      console.log(`[executeAcrossBridge] Deposit attempt ${attempt} failed:`, error.message);
    }
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

  // Wait for confirmation with timeout (background)
  Promise.race([
    depositTx.wait(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Transaction confirmation timeout')), TRANSACTION_TIMEOUT_MS)
    )
  ]).then(async (receipt: any) => {
    console.log('[executeAcrossBridge] Transaction confirmed:', receipt.transactionHash);
    const gasPrice = receipt.gasPrice || receipt.effectiveGasPrice;
    const gasCost = ethers.formatEther(gasPrice * receipt.gasUsed);
    
    await supabaseClient
      .from('bridge_transactions')
      .update({ 
        status: 'completed',
        gas_cost: gasCost,
        metadata: {
          completedAt: new Date().toISOString(),
        }
      })
      .eq('id', bridgeId);
  }).catch(async (error: any) => {
    console.error('[executeAcrossBridge] Transaction failed:', error);
    
    // Determine if should retry
    const shouldRetry = !/insufficient|invalid|unauthorized/i.test(error.message);
    
    await supabaseClient
      .from('bridge_transactions')
      .update({ 
        status: shouldRetry ? 'pending_retry' : 'failed',
        error_message: error.message,
        metadata: {
          failedAt: new Date().toISOString(),
          retryable: shouldRetry,
        }
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
    wormhole: ['avalanche', 'ethereum', 'bsc', 'polygon']
  };

  if (!supportedChains[provider]?.includes(sourceChain)) {
    throw new Error(`${provider} does not support ${sourceChain}. Supported chains: ${supportedChains[provider]?.join(', ')}`);
  }

  // Route to appropriate bridge provider
  switch (provider) {
    case 'across':
      return await executeAcrossBridge(sourceChain, privateKey, amount, destinationAddress, bridgeId, supabaseClient);
    
    case 'wormhole':
      return await executeWormholeBridge(sourceChain, privateKey, amount, destinationAddress, bridgeId, supabaseClient);
    
    default:
      throw new Error(`Unknown bridge provider: ${provider}`);
  }
}

async function executeWormholeBridge(
  sourceChain: string,
  privateKey: string,
  amount: number,
  destinationAddress: string,
  bridgeId: string,
  supabaseClient: any
) {
  console.log('[executeWormholeBridge] Starting Wormhole bridge from', sourceChain);

  // Handle Solana separately (non-EVM)
  if (sourceChain === 'solana') {
    return await executeWormholeBridgeSolana(privateKey, amount, destinationAddress, bridgeId, supabaseClient);
  }

  // Handle EVM chains
  return await executeWormholeBridgeEVM(sourceChain, privateKey, amount, destinationAddress, bridgeId, supabaseClient);
}

async function executeWormholeBridgeEVM(
  sourceChain: string,
  privateKey: string,
  amount: number,
  destinationAddress: string,
  bridgeId: string,
  supabaseClient: any
) {
  console.log('[executeWormholeBridgeEVM] Bridging from EVM chain:', sourceChain);

  const rpcUrl = getRpcUrl(sourceChain);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const tokenBridgeAddress = WORMHOLE_TOKEN_BRIDGES[sourceChain];
  const usdcAddress = USDC_ADDRESSES[sourceChain];

  if (!tokenBridgeAddress || !usdcAddress) {
    throw new Error(`Wormhole not configured for ${sourceChain}`);
  }

  console.log('[executeWormholeBridgeEVM] Using wallet:', wallet.address);

  // USDC contract
  const usdcAbi = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];
  const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);

  // Check balance with retry
  const decimals = await retryWithBackoff(() => usdcContract.decimals(), { maxRetries: 2 });
  const amountWei = ethers.parseUnits(amount.toString(), decimals);
  const balance = await retryWithBackoff(() => usdcContract.balanceOf(wallet.address), { maxRetries: 2 });

  console.log('[executeWormholeBridgeEVM] Balance check:', {
    balance: ethers.formatUnits(balance, decimals),
    required: amount,
  });

  if (balance < amountWei) {
    throw new NonRetryableError(`Insufficient USDC balance. Have: ${ethers.formatUnits(balance, decimals)}, Need: ${amount}`);
  }

  // Check and approve
  const allowance = await usdcContract.allowance(wallet.address, tokenBridgeAddress);
  console.log('[executeWormholeBridgeEVM] Current allowance:', ethers.formatUnits(allowance, decimals));

  if (allowance < amountWei) {
    console.log('[executeWormholeBridgeEVM] Approving USDC...');
    
    const approveTx = await retryWithBackoff(
      () => usdcContract.approve(tokenBridgeAddress, amountWei),
      { maxRetries: 3 }
    );
    
    console.log('[executeWormholeBridgeEVM] Approval tx:', approveTx.hash);

    await supabaseClient
      .from('bridge_transactions')
      .update({ approval_tx_hash: approveTx.hash })
      .eq('id', bridgeId);

    await Promise.race([
      approveTx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Approval timeout')), TRANSACTION_TIMEOUT_MS)
      )
    ]);
    
    console.log('[executeWormholeBridgeEVM] Approval confirmed');
  }

  // Wormhole Token Bridge ABI
  const tokenBridgeAbi = [
    'function transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64 sequence)',
    'function wormhole() view returns (address)',
  ];
  const tokenBridge = new ethers.Contract(tokenBridgeAddress, tokenBridgeAbi, wallet);

  // Target Arbitrum as intermediate (Wormhole chain ID)
  const targetChainId = WORMHOLE_CHAIN_IDS.arbitrum || CHAIN_ID_ARBITRUM;
  
  // Convert destination address to bytes32
  const recipientBytes32 = ethers.zeroPadValue(destinationAddress, 32);

  // Calculate Wormhole fee (typically small, ~0.001 ETH equivalent)
  const wormholeFee = ethers.parseEther('0.001');

  // Check native balance for fee
  const nativeBalance = await provider.getBalance(wallet.address);
  console.log('[executeWormholeBridgeEVM] Native balance:', ethers.formatEther(nativeBalance));

  if (nativeBalance < wormholeFee) {
    throw new Error(`Insufficient native token for Wormhole fee. Need: ${ethers.formatEther(wormholeFee)}, Have: ${ethers.formatEther(nativeBalance)}`);
  }

  console.log('[executeWormholeBridgeEVM] Executing Wormhole transfer...', {
    token: usdcAddress,
    amount: ethers.formatUnits(amountWei, decimals),
    targetChain: targetChainId,
    recipient: recipientBytes32,
  });

  // Execute transfer with retry
  const transferTx = await retryWithBackoff(
    () => tokenBridge.transferTokens(
      usdcAddress,
      amountWei,
      targetChainId,
      recipientBytes32,
      0, // arbiterFee
      Math.floor(Date.now() / 1000), // nonce
      { value: wormholeFee }
    ),
    { maxRetries: 3 },
    (attempt, error) => {
      console.log(`[executeWormholeBridgeEVM] Transfer attempt ${attempt} failed:`, error.message);
    }
  );

  console.log('[executeWormholeBridgeEVM] Transaction submitted:', transferTx.hash);

  // Update database
  await supabaseClient
    .from('bridge_transactions')
    .update({
      status: 'processing',
      source_tx_hash: transferTx.hash,
    })
    .eq('id', bridgeId);

  // Wait for confirmation with timeout and VAA fetching (background)
  Promise.race([
    transferTx.wait(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Transaction confirmation timeout')), TRANSACTION_TIMEOUT_MS)
    )
  ]).then(async (receipt: any) => {
    console.log('[executeWormholeBridgeEVM] Transaction confirmed:', receipt.transactionHash);
    
    // Parse sequence number from logs
    let sequence;
    let vaaData;
    try {
      const wormholeAddress = await tokenBridge.wormhole();
      sequence = parseSequenceFromReceipt(receipt, wormholeAddress);
      console.log('[executeWormholeBridgeEVM] Wormhole sequence:', sequence);
      
      // Fetch VAA in background
      const emitterAddress = await getEmitterAddressEth(tokenBridgeAddress);
      console.log('[executeWormholeBridgeEVM] Fetching VAA for sequence:', sequence);
      
      try {
        const vaa = await fetchVAA(targetChainId, emitterAddress, sequence.toString());
        vaaData = {
          vaaBytes: vaa.vaaBytes,
          fetched: true,
          fetchedAt: new Date().toISOString(),
        };
        console.log('[executeWormholeBridgeEVM] VAA fetched successfully');
      } catch (vaaError) {
        console.error('[executeWormholeBridgeEVM] VAA fetch failed:', vaaError);
        vaaData = {
          fetched: false,
          error: vaaError.message,
          note: 'VAA will be fetched automatically in background',
        };
      }
    } catch (e) {
      console.error('[executeWormholeBridgeEVM] Failed to parse sequence or fetch VAA:', e);
    }

    const gasPrice = receipt.gasPrice || receipt.effectiveGasPrice;
    const gasCost = ethers.formatEther(gasPrice * receipt.gasUsed);
    
    await supabaseClient
      .from('bridge_transactions')
      .update({
        status: vaaData?.fetched ? 'completed' : 'vaa_pending',
        gas_cost: gasCost,
        metadata: {
          wormhole_sequence: sequence,
          emitter_address: await getEmitterAddressEth(tokenBridgeAddress),
          vaa: vaaData,
          completedAt: new Date().toISOString(),
        },
      })
      .eq('id', bridgeId);
  }).catch(async (error: any) => {
    console.error('[executeWormholeBridgeEVM] Transaction failed:', error);
    
    const shouldRetry = !/insufficient|invalid|unauthorized/i.test(error.message);
    
    await supabaseClient
      .from('bridge_transactions')
      .update({
        status: shouldRetry ? 'pending_retry' : 'failed',
        error_message: error.message,
        metadata: {
          failedAt: new Date().toISOString(),
          retryable: shouldRetry,
        }
      })
      .eq('id', bridgeId);
  });

  return { txHash: transferTx.hash };
}

async function executeWormholeBridgeSolana(
  privateKey: string,
  amount: number,
  destinationAddress: string,
  bridgeId: string,
  supabaseClient: any
) {
  console.log('[executeWormholeBridgeSolana] Solana bridging not yet fully implemented');
  
  // Update status to failed with explanation
  await supabaseClient
    .from('bridge_transactions')
    .update({
      status: 'failed',
      error_message: 'Solana bridging requires additional Solana SDK integration. Please use Avalanche, Polygon, BSC, or Ethereum for now.',
    })
    .eq('id', bridgeId);

  throw new Error('Solana bridging via Wormhole requires additional Solana SDK integration. Please bridge from Avalanche, Polygon, BSC, or Ethereum instead.');
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
    error: bridge.error_message,
    gasCost: bridge.gas_cost
  };
}
