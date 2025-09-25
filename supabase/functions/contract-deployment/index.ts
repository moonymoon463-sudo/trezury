import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ethers } from "https://esm.sh/ethers@6.13.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

// Helper function to safely check error properties
function hasErrorProperty(error: unknown, property: string): boolean {
  return typeof error === 'object' && error !== null && property in error;
}

function getChainRPCs(chain: string): string[] {
  const infuraKey = Deno.env.get('INFURA_API_KEY');
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  const ankrKey = Deno.env.get('ANKR_API_KEY');
  
  const rpcs: Record<string, (string | null)[]> = {
    ethereum: [
      infuraKey ? `https://sepolia.infura.io/v3/${infuraKey}` : null,
      alchemyKey ? `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}` : null,
      ankrKey ? `https://rpc.ankr.com/eth_sepolia/${ankrKey}` : null,
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.gateway.tenderly.co',
      'https://rpc.sepolia.dev'
    ].filter(Boolean)
  };

  return (rpcs[chain] || []).filter(Boolean) as string[];
}

function getAuthenticatedRpcUrls(chain: string): string[] {
  const infuraKey = Deno.env.get('INFURA_API_KEY');
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  const ankrKey = Deno.env.get('ANKR_API_KEY');

  const authenticatedRpcs: string[] = [];
  
  if (infuraKey) authenticatedRpcs.push(`https://sepolia.infura.io/v3/${infuraKey}`);
  if (alchemyKey) authenticatedRpcs.push(`https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`);
  if (ankrKey) authenticatedRpcs.push(`https://rpc.ankr.com/eth_sepolia/${ankrKey}`);

  return authenticatedRpcs;
}

function validateDeploymentChain(chain: string): chain is 'ethereum' {
  const DEPLOYMENT_CHAINS = ['ethereum'];
  return DEPLOYMENT_CHAINS.includes(chain);
}

function safeStringify(value: any) {
  return JSON.stringify(value, (_key, val) => typeof val === 'bigint' ? val.toString() : val);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { operation } = requestBody;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🔧 Contract deployment operation: ${operation}`);

    switch (operation) {
      case 'deploy':
        return handleDeploy(requestBody.chain!, requestBody.contracts, supabase);
      case 'get_addresses':
        return handleGetAddresses(requestBody.chain!);
      case 'get_status':
        return handleGetStatus();
      case 'get_deployment_info':
        return handleGetDeploymentInfo();
      case 'store_contracts':
        return handleStoreContracts(requestBody.chain!, requestBody.contracts);
      case 'get_logs':
        const logs = await handleGetLogs(supabase, requestBody.chain || 'ethereum');
        return new Response(JSON.stringify(logs), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      case 'verify':
        return handleVerify(requestBody.chain!, requestBody.address, requestBody.contractName);
      case 'test_rpcs':
        return handleTestRpcs(requestBody.chain!);
      default:
        return new Response(JSON.stringify({ error: 'Invalid operation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Contract deployment failed:', error);
    return new Response(
      JSON.stringify({ error: 'Contract deployment failed', details: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleDeploy(chain: string, contracts: any, supabase: any) {
  if (!validateDeploymentChain(chain)) {
    return new Response(JSON.stringify({
      error: `Unsupported deployment chain: ${chain}. Only 'ethereum' (Sepolia testnet) is supported.`
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const deploymentPrivateKey = Deno.env.get('DEPLOYMENT_PRIVATE_KEY');
  if (!deploymentPrivateKey) {
    return new Response(JSON.stringify({
      error: 'DEPLOYMENT_PRIVATE_KEY not configured'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const rpcUrls = getChainRPCs(chain);
    if (rpcUrls.length === 0) {
      return new Response(JSON.stringify({
        error: 'No RPC URLs available for deployment'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log(`Testing ${rpcUrls.length} RPC endpoints...`);
    
    for (const testRpcUrl of rpcUrls) {
      try {
        const testProvider = new ethers.JsonRpcProvider(testRpcUrl);
        await testProvider.getBlockNumber();
        console.log(`✅ RPC connection successful: ${testRpcUrl.substring(0, 50)}...`);
        break;
      } catch (error) {
        console.log(`❌ RPC connection failed for ${testRpcUrl.substring(0, 50)}...: ${getErrorMessage(error)}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Contract deployment simulation completed',
      chain,
      contracts: contracts || {}
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: getErrorMessage(error),
      chain,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetAddresses(chain: string) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('deployed_contracts')
      .select('*')
      .eq('chain', chain)
      .order('deployed_at', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No deployed contracts found for this chain'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const addresses = Object.entries(data[0].contracts).map(([name, address]) => ({
      name,
      address
    }));

    return new Response(JSON.stringify({
      success: true,
      addresses
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error fetching contract addresses:', error);
    return new Response(JSON.stringify({
      success: false,
      error: getErrorMessage(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetStatus() {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('deployed_contracts')
      .select('*')
      .order('deployed_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      deployments: data || []
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error fetching deployment status:', error);
    return new Response(JSON.stringify({
      success: false,
      error: getErrorMessage(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleStoreContracts(chain: string, contracts: any) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('deployed_contracts')
      .insert({
        chain,
        contracts,
        deployed_at: new Date().toISOString(),
        deployer_address: 'simulation',
        deployment_metadata: {
          timestamp: new Date().toISOString(),
          environment: 'development'
        }
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error storing contracts:', error);
    return new Response(JSON.stringify({
      success: false,
      error: getErrorMessage(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleVerify(chain: string, address: string, contractName: string) {
  return new Response(JSON.stringify({
    success: true,
    message: 'Contract verification not implemented yet'
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleGetDeploymentInfo() {
  try {
    const deploymentPrivateKey = Deno.env.get('DEPLOYMENT_PRIVATE_KEY');
    
    if (!deploymentPrivateKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'DEPLOYMENT_PRIVATE_KEY not configured',
        deployer: null,
        gasEstimates: {},
        deployerBalance: 'Unknown'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const tempWallet = new ethers.Wallet(deploymentPrivateKey);
    
    let deployerBalance = 'Checking...';
    try {
      const authenticatedRpcs = getAuthenticatedRpcUrls('ethereum');
      if (authenticatedRpcs.length > 0) {
        const provider = new ethers.JsonRpcProvider(authenticatedRpcs[0]);
        const balance = await provider.getBalance(tempWallet.address);
        deployerBalance = `${ethers.formatEther(balance)} ETH`;
      }
    } catch (balanceError) {
      console.log('Could not fetch deployer balance:', getErrorMessage(balanceError));
      deployerBalance = 'Unable to fetch';
    }

    return new Response(JSON.stringify({
      success: true,
      deployer: tempWallet.address,
      gasEstimates: {
        ERC20TestToken: '~1,200,000 gas',
        LendingPool: '~2,500,000 gas',
        MockPriceOracle: '~800,000 gas'
      },
      deployerBalance,
      availableRpcs: getAuthenticatedRpcUrls('ethereum').length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: getErrorMessage(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetLogs(supabase: any, chain: string) {
  try {
    const { data, error } = await supabase
      .from('deployment_logs')
      .select('*')
      .eq('chain', chain)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return {
      success: true,
      logs: data || []
    };

  } catch (error) {
    console.error('Error fetching deployment logs:', error);
    return {
      success: false,
      error: getErrorMessage(error)
    };
  }
}

async function handleTestRpcs(chain: string) {
  const rpcUrls = getChainRPCs(chain);
  const results: any = {
    chain,
    total_rpcs: rpcUrls.length,
    working_rpcs: 0,
    failed_rpcs: 0,
    rpc_tests: {} as Record<string, any>,
    recommendations: [] as string[]
  };

  for (const rpcUrl of rpcUrls) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      
      results.rpc_tests[rpcUrl.substring(0, 30) + '...'] = { status: 'success', blockNumber };
      results.working_rpcs++;
    } catch (error) {
      results.rpc_tests[rpcUrl.substring(0, 30) + '...'] = { status: 'failed', error: getErrorMessage(error) };
      results.failed_rpcs++;
    }
  }

  if (results.working_rpcs === 0) {
    results.recommendations.push('All RPC connections failed - check network connectivity');
  }

  if (getAuthenticatedRpcUrls(chain).length === 0) {
    results.recommendations.push('Add at least one RPC provider API key for reliable connectivity');
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase
      .from('deployment_logs')
      .insert({
        chain,
        operation: 'rpc_test',
        status: results.working_rpcs > 0 ? 'success' : 'failed',
        message: `RPC test completed: ${results.working_rpcs}/${results.total_rpcs} working`,
        metadata: results
      });
  } catch (logError) {
    console.error('Failed to log RPC test results:', logError);
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}