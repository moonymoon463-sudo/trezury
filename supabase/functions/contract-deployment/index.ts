import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.7.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeploymentRequest {
  operation: 'deploy' | 'verify' | 'get_addresses' | 'get_status' | 'get_deployment_info' | 'health_check' | 'diagnose';
  chain?: string;
  privateKey?: string;
  rpcUrl?: string;
  fallbackRpcs?: string[];
}

// Authenticated RPC URLs with API keys
function getAuthenticatedRpcUrls(chain: string) {
  const infuraKey = Deno.env.get('INFURA_API_KEY');
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  const ankrKey = Deno.env.get('ANKR_API_KEY');

  const rpcs = {
    ethereum: [
      infuraKey ? `https://sepolia.infura.io/v3/${infuraKey}` : null,
      alchemyKey ? `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}` : null,
      ankrKey ? `https://rpc.ankr.com/eth_sepolia/${ankrKey}` : null,
      // Public fallback RPCs
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.gateway.tenderly.co',
      'https://rpc.sepolia.dev'
    ].filter(Boolean)
  };

  return rpcs[chain] || [];
}

// Add chain validation for contract deployment
function validateDeploymentChain(chain: string): chain is 'ethereum' {
  const DEPLOYMENT_CHAINS = ['ethereum'];
  return DEPLOYMENT_CHAINS.includes(chain);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody: DeploymentRequest = await req.json();
    const { operation, chain, privateKey, rpcUrl, fallbackRpcs } = requestBody;

    console.log(`Processing contract deployment operation: ${operation}`);

    switch (operation) {
      case 'deploy':
        if (!validateDeploymentChain(chain!)) {
          console.error('Invalid deployment chain:', chain);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Unsupported chain for deployment: ${chain}. Only Ethereum is currently supported.` 
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await handleDeploy(supabase, chain!, privateKey!, rpcUrl!, fallbackRpcs);
      
      case 'verify':
        if (!validateDeploymentChain(chain!)) {
          console.error('Invalid chain for verification:', chain);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Unsupported chain for verification: ${chain}. Only Ethereum is currently supported.` 
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await handleVerify(supabase, chain!);
      
      case 'get_addresses':
        return await handleGetAddresses(supabase, chain!);
      
      case 'get_status':
        return await handleGetStatus(supabase);
      
      case 'get_deployment_info':
        return await handleGetDeploymentInfo();
      
      case 'diagnose':
        return await handleDiagnose(chain);
        
      case 'health_check':
        console.log('Health check requested');
        const hasPrivateKey = !!Deno.env.get('DEPLOYMENT_PRIVATE_KEY');
        return new Response(
          JSON.stringify({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            version: '1.0.1',
            secrets_configured: hasPrivateKey
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error) {
    console.error('Contract deployment error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Contract deployment failed',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleDeploy(supabase: any, chain: string, privateKey: string = "", rpcUrl: string, fallbackRpcs: string[] = []) {
  console.log(`🚀 Deploying contracts to ${chain} blockchain...`);

  try {
    // Validate deployment private key with better error messages
    let deploymentPrivateKey = privateKey;
    if (!deploymentPrivateKey) {
      deploymentPrivateKey = Deno.env.get('DEPLOYMENT_PRIVATE_KEY');
      if (!deploymentPrivateKey) {
        console.error('❌ DEPLOYMENT_PRIVATE_KEY environment variable not found');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Deployment service configuration error',
            details: 'DEPLOYMENT_PRIVATE_KEY not configured. Please contact support to configure the deployment wallet.',
            code: 'MISSING_DEPLOYMENT_KEY'
          }),
          { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }
    }

    // Get authenticated RPC URLs for the chain
    const authenticatedRpcs = getAuthenticatedRpcUrls(chain);
    const allRpcs = [...authenticatedRpcs, rpcUrl, ...fallbackRpcs].filter(Boolean);
    const uniqueRpcs = [...new Set(allRpcs)]; // Remove duplicates
    
    console.log(`🔗 Attempting connection to ${uniqueRpcs.length} RPC endpoints for ${chain}...`);
    console.log(`🔑 ${authenticatedRpcs.length} authenticated RPCs available`);
    
    let provider = null;
    let rpcIndex = 0;
    const rpcResults = [];
    
    for (const rpcUrl of uniqueRpcs) {
      try {
        rpcIndex++;
        const isAuthenticated = authenticatedRpcs.includes(rpcUrl);
        console.log(`🔄 Trying RPC ${rpcIndex}/${uniqueRpcs.length}: ${rpcUrl.substring(0, 50)}... ${isAuthenticated ? '[AUTH]' : '[PUBLIC]'}`);
        
        const testProvider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
          staticNetwork: true,
          batchMaxCount: 1,
          pollingInterval: 12000
        });
        
        // Test connection with a timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout after 8s')), 8000)
        );
        
        const blockNumber = await Promise.race([
          testProvider.getBlockNumber(),
          timeoutPromise
        ]);
        
        console.log(`✅ RPC connection successful: ${rpcUrl.substring(0, 50)}... (Block: ${blockNumber})`);
        provider = testProvider;
        rpcResults.push({ url: rpcUrl, status: 'success', authenticated: isAuthenticated, blockNumber });
        break;
      } catch (error) {
        console.log(`❌ RPC connection failed for ${rpcUrl.substring(0, 50)}...: ${error.message}`);
        rpcResults.push({ url: rpcUrl, status: 'failed', error: error.message, authenticated: authenticatedRpcs.includes(rpcUrl) });
        continue;
      }
    }

    if (!provider) {
      console.error(`💥 All ${uniqueRpcs.length} RPC endpoints failed for ${chain}`);
      const authenticatedFailed = rpcResults.filter(r => r.authenticated && r.status === 'failed').length;
      
      return new Response(JSON.stringify({
        success: false,
        error: `All ${uniqueRpcs.length} RPC endpoints failed for ${chain}. ${authenticatedFailed > 0 ? `${authenticatedFailed} authenticated RPCs failed - check API keys.` : 'Network connectivity issues detected.'}`,
        rpcResults,
        suggestion: authenticatedFailed > 0 ? 'Verify RPC provider API keys are valid' : 'Check network connectivity'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503
      });
    }

    return await deployRealContracts(supabase, chain, deploymentPrivateKey, provider);

  } catch (error) {
    console.error(`💥 Deployment failed for ${chain}:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        code: 'DEPLOYMENT_FAILED'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
}

async function deployRealContracts(supabase: any, chain: string, privateKey: string, provider: any) {
  console.log(`Deploying real contracts to ${chain}`);

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deploying from address: ${wallet.address}`);

  // Load contract ABIs
  const MockERC20ABI = JSON.parse(await Deno.readTextFile('./abis/MockERC20.json')).abi;
  const LendingPoolABI = JSON.parse(await Deno.readTextFile('./abis/LendingPool.json')).abi;

  // Contract deployment parameters
  const initialSupply = ethers.parseUnits("1000000", 18); // 1 million tokens

  try {
    // Deploy MockERC20 contracts
    const usdc = await deployContract(wallet, MockERC20ABI, ['USD Coin', 'USDC', initialSupply]);
    const usdt = await deployContract(wallet, MockERC20ABI, ['Tether USD', 'USDT', initialSupply]);
    const dai = await deployContract(wallet, MockERC20ABI, ['Dai Stablecoin', 'DAI', initialSupply]);
    const xaut = await deployContract(wallet, MockERC20ABI, ['Tether Gold', 'XAUT', initialSupply]);
    const auru = await deployContract(wallet, MockERC20ABI, ['AurusGOLD', 'AURU', initialSupply]);

    // Deploy LendingPool contract
    const lendingPool = await deployContract(wallet, LendingPoolABI, [
      usdc.address,
      usdt.address,
      dai.address,
      xaut.address,
      auru.address
    ]);

    console.log('Contracts deployed successfully!');
    console.log('USDC Address:', usdc.address);
    console.log('USDT Address:', usdt.address);
    console.log('DAI Address:', dai.address);
    console.log('XAUT Address:', xaut.address);
    console.log('AURU Address:', auru.address);
    console.log('LendingPool Address:', lendingPool.address);

    // Save contract addresses to Supabase
    const { error } = await supabase
      .from('contract_addresses')
      .upsert([
        { chain, contract_name: 'USDC', contract_address: usdc.address },
        { chain, contract_name: 'USDT', contract_address: usdt.address },
        { chain, contract_name: 'DAI', contract_address: dai.address },
        { chain, contract_name: 'XAUT', contract_address: xaut.address },
        { chain, contract_name: 'AURU', contract_address: auru.address },
        { chain, contract_name: 'LendingPool', contract_address: lendingPool.address }
      ], { onConflict: ['chain', 'contract_name'] });

    if (error) {
      console.error('Failed to save contract addresses to Supabase:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save contract addresses', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update deployment status in Supabase
    const { error: statusError } = await supabase
      .from('chain_deployment_status')
      .upsert([{ chain, is_deployed: true }], { onConflict: ['chain'] });

    if (statusError) {
      console.error('Failed to update deployment status in Supabase:', statusError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update deployment status', details: statusError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contracts deployed and addresses saved successfully!',
        contracts: {
          usdc: usdc.address,
          usdt: usdt.address,
          dai: dai.address,
          xaut: xaut.address,
          auru: auru.address,
          lendingPool: lendingPool.address
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Contract deployment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Contract deployment failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function deployContract(wallet: any, abi: any, args: any) {
  console.log(`Deploying contract with args: ${args}`);
  const factory = new ethers.ContractFactory(abi, abi, wallet);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function handleVerify(supabase: any, chain: string) {
  console.log(`Verifying contracts on ${chain}`);

  try {
    // Fetch contract addresses from Supabase
    const { data, error } = await supabase
      .from('contract_addresses')
      .select('*')
      .eq('chain', chain);

    if (error) {
      console.error('Failed to fetch contract addresses from Supabase:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch contract addresses', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data || data.length === 0) {
      console.warn('No contract addresses found for chain:', chain);
      return new Response(
        JSON.stringify({ success: false, error: 'No contract addresses found for this chain' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the contracts found
    console.log(`Found contracts: ${data.map(c => c.contract_name).join(', ')}`);

    // Mark contracts as verified (Placeholder - replace with actual verification logic)
    const { error: updateError } = await supabase
      .from('contract_addresses')
      .update({ is_verified: true })
      .eq('chain', chain);

    if (updateError) {
      console.error('Failed to update verification status in Supabase:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update verification status', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update deployment status in Supabase
    const { error: statusError } = await supabase
      .from('chain_deployment_status')
      .upsert([{ chain, is_verified: true }], { onConflict: ['chain'] });

    if (statusError) {
      console.error('Failed to update verification status in Supabase:', statusError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update verification status', details: statusError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Contracts marked as verified successfully!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Contract verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Contract verification failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetAddresses(supabase: any, chain: string) {
  console.log(`Getting contract addresses for ${chain}`);

  try {
    const { data, error } = await supabase
      .from('contract_addresses')
      .select('contract_name, contract_address, is_verified')
      .eq('chain', chain);

    if (error) {
      console.error('Failed to fetch contract addresses from Supabase:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch contract addresses', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data || data.length === 0) {
      console.warn('No contract addresses found for chain:', chain);
      return new Response(
        JSON.stringify({ success: false, error: 'No contract addresses found for this chain' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert the data into a more readable format
    const contractAddresses = data.reduce((acc, contract) => {
      acc[contract.contract_name] = {
        address: contract.contract_address,
        is_verified: contract.is_verified || false  // Default to false if null
      };
      return acc;
    }, {});

    return new Response(
      JSON.stringify({ success: true, chain, contractAddresses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting contract addresses:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to retrieve contract addresses', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetStatus(supabase: any) {
  console.log('Getting deployment status');

  try {
    const { data, error } = await supabase
      .from('chain_deployment_status')
      .select('*');

    if (error) {
      console.error('Failed to fetch deployment status from Supabase:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch deployment status', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert the data into a more readable format
    const deploymentStatus = data.reduce((acc, status) => {
      acc[status.chain] = status.is_deployed;
      return acc;
    }, {});

    return new Response(
      JSON.stringify({ success: true, deploymentStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting deployment status:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to retrieve deployment status', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleDiagnose(chain = 'ethereum') {
  try {
    console.log(`🔍 Running diagnostics for ${chain}...`);
    
    const privateKey = Deno.env.get('DEPLOYMENT_PRIVATE_KEY');
    const infuraKey = Deno.env.get('INFURA_API_KEY');
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
    const ankrKey = Deno.env.get('ANKR_API_KEY');
    
    // Check secrets configuration
    const secretsStatus = {
      deployment_private_key: !!privateKey,
      infura_api_key: !!infuraKey,
      alchemy_api_key: !!alchemyKey,
      ankr_api_key: !!ankrKey
    };
    
    // Get deployer info
    let deployerInfo = null;
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey);
      deployerInfo = {
        address: wallet.address,
        balance: "Checking..."
      };
    }
    
    // Test RPC connections
    const rpcTests = [];
    const authenticatedRpcs = getAuthenticatedRpcUrls(chain);
    
    for (const rpcUrl of authenticatedRpcs.slice(0, 5)) { // Test first 5
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const start = Date.now();
        const blockNumber = await Promise.race([
          provider.getBlockNumber(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        const latency = Date.now() - start;
        
        rpcTests.push({
          url: rpcUrl.substring(0, 50) + '...',
          status: 'success',
          blockNumber,
          latency: `${latency}ms`,
          authenticated: authenticatedRpcs.includes(rpcUrl)
        });
        
        // Get deployer balance from first successful RPC
        if (deployerInfo && deployerInfo.balance === "Checking...") {
          try {
            const balanceWei = await provider.getBalance(deployerInfo.address);
            const balanceEth = parseFloat(ethers.formatEther(balanceWei));
            deployerInfo.balance = `${balanceEth.toFixed(4)} ETH`;
            if (balanceEth < 0.01) deployerInfo.balance += " (LOW)";
          } catch (balanceError) {
            deployerInfo.balance = "Unable to check";
          }
        }
      } catch (error) {
        rpcTests.push({
          url: rpcUrl.substring(0, 50) + '...',
          status: 'failed',
          error: error.message,
          authenticated: authenticatedRpcs.includes(rpcUrl)
        });
      }
    }
    
    // Health summary
    const healthScore = [
      secretsStatus.deployment_private_key ? 25 : 0,
      (secretsStatus.infura_api_key || secretsStatus.alchemy_api_key || secretsStatus.ankr_api_key) ? 25 : 0,
      rpcTests.some(r => r.status === 'success') ? 25 : 0,
      (deployerInfo?.balance && !deployerInfo.balance.includes('LOW')) ? 25 : 0
    ].reduce((a, b) => a + b, 0);
    
    return new Response(JSON.stringify({
      success: true,
      chain,
      timestamp: new Date().toISOString(),
      healthScore,
      secretsStatus,
      deployerInfo,
      rpcTests,
      recommendations: [
        ...(!secretsStatus.deployment_private_key ? ['Add DEPLOYMENT_PRIVATE_KEY secret'] : []),
        ...(!secretsStatus.infura_api_key && !secretsStatus.alchemy_api_key && !secretsStatus.ankr_api_key ? ['Add at least one RPC provider API key (INFURA_API_KEY, ALCHEMY_API_KEY, or ANKR_API_KEY)'] : []),
        ...(rpcTests.length === 0 || !rpcTests.some(r => r.status === 'success') ? ['Fix RPC connectivity issues'] : []),
        ...(deployerInfo?.balance?.includes('LOW') ? ['Fund deployer wallet with Sepolia ETH'] : [])
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('Diagnostics failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

async function handleGetDeploymentInfo() {
  try {
    const privateKey = Deno.env.get('DEPLOYMENT_PRIVATE_KEY');
    if (!privateKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Deployment private key not configured'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const wallet = new ethers.Wallet(privateKey);
    const deployerAddress = wallet.address;
    
    console.log(`📋 Deployment Info Request - Deployer: ${deployerAddress}`);

    // Get deployer balance using authenticated RPCs
    let deployerBalance = "Unable to check";
    try {
      const rpcUrls = getAuthenticatedRpcUrls('ethereum');
      let provider = null;
      
      for (const rpcUrl of rpcUrls.slice(0, 3)) { // Try first 3 authenticated RPCs
        try {
          provider = new ethers.JsonRpcProvider(rpcUrl);
          await provider.getBlockNumber(); // Test connection
          break;
        } catch (error) {
          console.log(`RPC test failed for ${rpcUrl.substring(0, 30)}...: ${error.message}`);
          continue;
        }
      }
      
      if (provider) {
        const balanceWei = await provider.getBalance(deployerAddress);
        const balanceEth = parseFloat(ethers.formatEther(balanceWei));
        deployerBalance = `${balanceEth.toFixed(4)} ETH`;
        
        if (balanceEth < 0.01) {
          deployerBalance += " (LOW - Need funding)";
        }
      }
    } catch (error) {
      console.error('Failed to check deployer balance:', error);
      deployerBalance = "Check failed";
    }

    // Gas estimates for different chains
    const gasEstimates = {
      ethereum: "~0.02-0.05 ETH"
    };

    return new Response(JSON.stringify({
      success: true,
      deployerAddress,
      deployerBalance,
      gasEstimates,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error getting deployment info:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
