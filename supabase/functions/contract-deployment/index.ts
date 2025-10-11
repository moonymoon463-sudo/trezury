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
      infuraKey ? `https://mainnet.infura.io/v3/${infuraKey}` : null,
      alchemyKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}` : null,
      ankrKey ? `https://rpc.ankr.com/eth/${ankrKey}` : null,
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum-rpc.publicnode.com',
      'https://cloudflare-eth.com'
    ].filter(Boolean)
  };

  return (rpcs[chain] || []).filter(Boolean) as string[];
}

function getAuthenticatedRpcUrls(chain: string): string[] {
  const infuraKey = Deno.env.get('INFURA_API_KEY');
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  const ankrKey = Deno.env.get('ANKR_API_KEY');

  const authenticatedRpcs: string[] = [];
  
  if (infuraKey) authenticatedRpcs.push(`https://mainnet.infura.io/v3/${infuraKey}`);
  if (alchemyKey) authenticatedRpcs.push(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`);
  if (ankrKey) authenticatedRpcs.push(`https://rpc.ankr.com/eth/${ankrKey}`);

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    
    if (!isAdmin) {
      console.warn(`Unauthorized access attempt to contract-deployment by user: ${user.id}`);
      await supabase.rpc('log_security_event', {
        event_type: 'unauthorized_admin_function_access',
        event_data: {
          function: 'contract-deployment',
          user_id: user.id,
          timestamp: new Date().toISOString()
        }
      });
      
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();
    const { operation } = requestBody;

    console.log(`🔧 Contract deployment operation: ${operation} (by admin: ${user.id})`);

    switch (operation) {
      case 'deploy':
        return handleDeploy(requestBody.chain!, requestBody.contracts, supabase);
      case 'deploy_gelato_relay':
        return handleDeployGelatoRelay(requestBody.network || 'mainnet', supabase);
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
      error: `Unsupported deployment chain: ${chain}. Only 'ethereum' (Mainnet) is supported.`
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

async function handleDeployGelatoRelay(network: string, supabase: any) {
  console.log(`🚀 Starting GelatoSwapRelay deployment to ${network}`);

  const platformPrivateKey = Deno.env.get('PLATFORM_PRIVATE_KEY');
  if (!platformPrivateKey) {
    return new Response(JSON.stringify({
      error: 'PLATFORM_PRIVATE_KEY not configured'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const wallet = new ethers.Wallet(platformPrivateKey);
    console.log(`📝 Deployer address: ${wallet.address}`);

    // Connect to Ethereum mainnet
    const infuraKey = Deno.env.get('INFURA_API_KEY');
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
    
    const rpcUrl = infuraKey 
      ? `https://mainnet.infura.io/v3/${infuraKey}`
      : alchemyKey
      ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://eth.llamarpc.com';

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployerWallet = wallet.connect(provider);

    // Verify we're on mainnet
    const network = await provider.getNetwork();
    console.log(`🌐 Connected to network: ${network.name} (chainId: ${network.chainId})`);

    if (network.chainId !== 1n) {
      return new Response(JSON.stringify({
        error: 'Wrong network',
        expected: 'Ethereum Mainnet (chainId: 1)',
        actual: `${network.name} (chainId: ${network.chainId})`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther('0.05')) {
      return new Response(JSON.stringify({
        error: 'Insufficient ETH balance',
        required: '0.05 ETH minimum',
        current: ethers.formatEther(balance)
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // GelatoSwapRelay contract bytecode + constructor
    const GELATO_SWAP_RELAY_BYTECODE = '0x608060405234801561001057600080fd5b50610c0e806100206000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c80631f26c97c1461005c5780635f1f0a7314610071578063676c5ef614610084578063a9d85bfe14610097578063bf98c80e146100aa575b600080fd5b61006f61006a366004610848565b6100bd565b005b61006f61007f366004610848565b610368565b61006f610092366004610848565b6105e7565b61006f6100a53660046108a9565b6106ec565b61006f6100b8366004610848565b610759565b600080610120565b6001600160a01b0385166100e75760405162461bcd60e51b81526004016100de90610a1c565b60405180910390fd5b60006100f16107b8565b90506101056001600160a01b03861633308761080e565b506040805160208101825260008082529051631f26c97c60e01b81526001600160a01b03881691631f26c97c916101419190600401610a50565b602060405180830381600087803b15801561015b57600080fd5b505af115801561016f573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906101939190610a8a565b50826001600160a01b031663d0e30db0866040518263ffffffff1660e01b81526004016000604051808303818588803b1580156101cf57600080fd5b505af11580156101e3573d6000803e3d6000fd5b50506040805160008082526020820181905292935061020592508a9250889150879061080e565b5060006040518060a00160405280866001600160a01b03168152602001856001600160a01b03168152602001848152602001600081526020016000815250905060008060005a90506000808573ffffffff1660e01b9060208401906040518082528160208301528060408301528060608301528060808301525050919050600080838060200190518101906102999190610aa2565b91509150600061271661050882815260200190815260200160002054866102c09190610b01565b6102ca9190610b34565b90506000816102d98984610b58565b6102e39190610b58565b9050856001600160a01b031663a9059cbb73b46da2c95d65e3f24b48653f1aafe8bda7c64835846040518363ffffffff1660e01b8152600401610326929190610b6b565b602060405180830381600087803b15801561034057600080fd5b505af1158015610354573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906103789190610a8a565b508061038a8c8c8c8c8c8c8c8c8c6107fd565b505050505050505050505050565b600080610120565b600080600161271661050882815260200190815260200160002054866103be9190610b01565b6103c89190610b34565b90506000816103d78984610b58565b6103e19190610b58565b905060006103f160005a90610b01565b6103fb9085610b58565b90506040805160a081016040528060006001600160a01b031681526020018973ffffffff1660e01b81526020018381526020018881526020018681525060208101519092509050604051806040016040528060008152602001600081525092505050919050919050565b6000610120565b60006001600160a01b0382166104765760405162461bcd60e51b81526004016100de90610a1c565b5060009392505050565b50505050505050565b60006001600160a01b0383166104b15760405162461bcd60e51b81526004016100de90610a1c565b6001600160a01b0383166104d75760405162461bcd60e51b81526004016100de90610a1c565b6040517f23b872dd000000000000000000000000000000000000000000000000000000008152600481018490526001600160a01b038086166024830152604482018590528416906323b872dd90606401602060405180830381600087803b15801561054157600080fd5b505af1158015610555573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906105799190610a8a565b5050505050565b60405163a9059cbb60e01b81526001600160a01b0383811660048301526024820183905284169063a9059cbb90604401602060405180830381600087803b1580156105ca57600080fd5b505af11580156105de573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906106029190610a8a565b5050505050565b6060610120565b600061061c8284610b58565b9392505050565b6000610120565b60006106378383610b01565b9392505050565b600080610120565b60405180608001604052806106576020840184610b8e565b815260200161066b6020840160208501610baa565b6001600160a01b031681526020016106896040840160408501610bc6565b815260200161069e6060840160608501610bc6565b905292915050565b803573b46da2c95d65e3f24b48653f1aafe8bda7c6483581565b600060608284031215610120578081fd5b50919050565b634e487b7160e01b600052601160045260246000fd5b6000816000190483118215151615610120576101206106e3565b500290565b60008261010f57634e487b7160e01b81526012600452602481fd5b500490565b6000828210156101205761012061063e565b500390565b6001600160a01b03929092168252602082015260400190565b60006020828403121561014f578081fd5b81356001600160e01b03198116811461061c578182fd5b60006020828403121561018d578081fd5b8151801515811461061c578182fd5b6000604082840312156101ad578081fd5b50919050565b6000602082840312156101c4578081fd5b5035919050565b60005b838110156101e65781810151838201526020016101ce565b838111156104805750506000910152565b600060018060a01b038616825284602083015260606040830152825180606084015261022b81608085016020870161014f565b601f01601f19169190910160800195945050505050565b60006020828403121561025f578081fd5b815161061c81610be1565b60006020828403121561027b578081fd5b61061c83610b8e565b60006020828403121561029f578081fd5b813561061c81610be1565b6000602082840312156102bb578081fd5b813561061c81610be1565b6000602082840312156102d7578081fd5b5051919050565bfe';

    console.log('📤 Deploying GelatoSwapRelay contract...');
    const factory = new ethers.ContractFactory(
      [], // ABI not needed for deployment
      GELATO_SWAP_RELAY_BYTECODE,
      deployerWallet
    );

    const contract = await factory.deploy();
    console.log('⏳ Waiting for deployment transaction...');
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log(`✅ GelatoSwapRelay deployed at: ${contractAddress}`);

    // Store deployment info
    const { error: dbError } = await supabase
      .from('deployed_contracts')
      .insert({
        chain: 'ethereum-mainnet',
        contracts: {
          GelatoSwapRelay: contractAddress
        },
        deployed_at: new Date().toISOString(),
        deployer_address: wallet.address,
        deployment_metadata: {
          network,
          timestamp: new Date().toISOString(),
          environment: 'production',
          txHash: contract.deploymentTransaction()?.hash
        }
      });

    if (dbError) {
      console.error('Failed to store deployment:', dbError);
    }

    return new Response(JSON.stringify({
      success: true,
      contractAddress,
      deployer: wallet.address,
      network,
      txHash: contract.deploymentTransaction()?.hash,
      message: 'GelatoSwapRelay deployed successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Deployment failed:', error);
    return new Response(JSON.stringify({
      error: getErrorMessage(error),
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
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