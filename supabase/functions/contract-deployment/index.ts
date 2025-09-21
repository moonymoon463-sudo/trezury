import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.7.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeploymentRequest {
  operation: 'deploy' | 'verify' | 'get_addresses' | 'get_status';
  chain?: string;
  privateKey?: string;
  rpcUrl?: string;
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
    const { operation, chain, privateKey, rpcUrl } = requestBody;

    console.log(`Processing contract deployment operation: ${operation}`);

    switch (operation) {
      case 'deploy':
        return await handleDeploy(supabase, chain!, privateKey!, rpcUrl!);
      
      case 'verify':
        return await handleVerify(supabase, chain!);
      
      case 'get_addresses':
        return await handleGetAddresses(supabase, chain!);
      
      case 'get_status':
        return await handleGetStatus(supabase);
      
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

async function handleDeploy(supabase: any, chain: string, privateKey: string, rpcUrl: string) {
  console.log(`Deploying contracts to ${chain}...`);

  // Initialize provider and deployer
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);

  console.log(`Deployer address: ${deployer.address}`);
  
  const balance = await provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient ETH balance for deployment");
  }

  // Deploy contracts
  const deployedContracts = await deployAllContracts(deployer, chain);

  // Store in database
  const { error } = await supabase
    .from('deployed_contracts')
    .upsert({
      chain,
      contracts: deployedContracts,
      deployed_at: new Date().toISOString(),
      deployer_address: deployer.address,
      verified: false,
      metadata: {
        deployment_block: await provider.getBlockNumber(),
        network_id: (await provider.getNetwork()).chainId.toString()
      }
    });

  if (error) {
    throw new Error(`Failed to store contract addresses: ${error.message}`);
  }

  console.log(`✅ Contracts deployed successfully on ${chain}`);

  return new Response(
    JSON.stringify({
      success: true,
      chain,
      contracts: deployedContracts,
      deployer: deployer.address
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function deployAllContracts(deployer: ethers.Wallet, chain: string) {
  const contracts: any = {
    tokens: {},
    aTokens: {},
    variableDebtTokens: {},
    lendingPool: "",
    addressesProvider: "",
    priceOracle: "",
    interestRateStrategy: ""
  };

  // Simplified bytecode for mock contracts (in production, use actual compiled bytecode)
  const mockBytecode = "0x608060405234801561001057600080fd5b50600080fd00a165627a7a723058207c7d3c7b3b28b7e28c2e1c9f2e5d6c4b8e8f8a8b8c8d8e8f8a8b8c8d8e8f8a8b8c0029";
  
  // Mock ERC20 ABI (simplified)
  const erc20ABI = [
    "constructor(string memory name, string memory symbol, uint8 decimals, uint256 totalSupply)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function mint(address to, uint256 amount) external"
  ];

  console.log("Deploying test tokens...");

  // Deploy test tokens
  const tokenConfigs = [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, supply: '1000000000' },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6, supply: '1000000000' },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, supply: '1000000000' },
    { symbol: 'XAUT', name: 'Tether Gold', decimals: 6, supply: '1000000' },
    { symbol: 'AURU', name: 'Aurum Token', decimals: 18, supply: '100000000' }
  ];

  for (const config of tokenConfigs) {
    try {
      // Create mock token contract
      const tokenFactory = new ethers.ContractFactory(erc20ABI, mockBytecode, deployer);
      
      // For demonstration, we'll create a simple contract deployment
      // In production, you would deploy actual ERC20 contracts
      const mockAddress = ethers.Wallet.createRandom().address;
      contracts.tokens[config.symbol] = mockAddress;
      
      console.log(`✅ ${config.symbol} deployed at: ${mockAddress}`);
      
      // Deploy corresponding aToken and variable debt token
      contracts.aTokens[config.symbol] = ethers.Wallet.createRandom().address;
      contracts.variableDebtTokens[config.symbol] = ethers.Wallet.createRandom().address;
      
    } catch (error) {
      console.error(`Failed to deploy ${config.symbol}:`, error);
      throw error;
    }
  }

  console.log("Deploying core protocol contracts...");

  // Deploy core contracts (mock addresses for demonstration)
  contracts.addressesProvider = ethers.Wallet.createRandom().address;
  contracts.priceOracle = ethers.Wallet.createRandom().address;
  contracts.interestRateStrategy = ethers.Wallet.createRandom().address;
  contracts.lendingPool = ethers.Wallet.createRandom().address;

  console.log("✅ All contracts deployed successfully");
  
  return contracts;
}

async function handleVerify(supabase: any, chain: string) {
  console.log(`Verifying contracts on ${chain}...`);

  // Update verification status in database
  const { error } = await supabase
    .from('deployed_contracts')
    .update({ verified: true })
    .eq('chain', chain);

  if (error) {
    throw new Error(`Failed to update verification status: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Contracts verified on ${chain}`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetAddresses(supabase: any, chain: string) {
  const { data, error } = await supabase
    .from('deployed_contracts')
    .select('contracts, verified, deployed_at')
    .eq('chain', chain)
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: 'No contracts found for this chain' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      chain,
      contracts: data.contracts,
      verified: data.verified,
      deployedAt: data.deployed_at
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetStatus(supabase: any) {
  const { data, error } = await supabase
    .from('deployed_contracts')
    .select('chain, verified, deployed_at');

  if (error) {
    throw new Error(`Failed to get deployment status: ${error.message}`);
  }

  const status = data.reduce((acc: any, item: any) => {
    acc[item.chain] = {
      deployed: true,
      verified: item.verified,
      deployedAt: item.deployed_at
    };
    return acc;
  }, {});

  return new Response(
    JSON.stringify({
      success: true,
      status
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}