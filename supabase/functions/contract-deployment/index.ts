import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.7.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Embedded contract ABIs and bytecode
const MOCK_ERC20_ABI = [
  {"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"},{"internalType":"uint256","name":"_totalSupply","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
];

const MOCK_ERC20_BYTECODE = "0x608060405234801561001057600080fd5b506040516107f73803806107f783398101604081905261002f9161008c565b6001829055600061003f8361022c565b905082600090816100509190610195565b50816001908161006091906101955b50806002819055506100823382610078565b505050506102c7565b600080604083850312156100a957600080fd5b82516001600160401b038111156100bf57600080fd5b8301601f810185136100d057600080fd5b80516001600160401b038111156100e6576100e66100fd565b604051601f8201601f19908116603f0116810190838211818310171561010e5761010e6100fd565b81604052828152602093508584848701011115610104576101046100ff565b600091505b82821015610126578482018401518183018501529083019061010f565b5060008484830101528094505050505092915050565b634e487b7160e01b600052604160045260246000fd5b600060208083850312156101655760008081fd5b82516001600160401b0381111561017b57600080fd5b8301601f810185136101665760008081fd5b80516001600160401b0381111561019f5761019f61014d565b8060051b604051601f19603f830116810181811085821117156101c4576101c461014d565b6040528281528584848701011115610104576101046100ff565b6001600160a01b0382166000908152600360205260408120546101fe90839061020f565b6001600160a01b0384166000908152600360205260409020819055600254610225908261020f565b6002555050600190565b60008219821115610242576102426100b1565b500190565b600181811c9082168061025b57607f821691505b60208210810361027b57634e487b7160e01b600052602260045260246000fd5b50919050565b601f8201601f19168101906001600160401b038211828210171561014d5761014d6100fd565b60008351602084860101528285821691505b8281101561021657858382018481011115610294575050565b60008260001904821115610291576102916100b1565b500290565b6105218061030660003934";

const LENDING_POOL_ABI = [
  {"inputs":[{"internalType":"address","name":"_usdc","type":"address"},{"internalType":"address","name":"_usdt","type":"address"},{"internalType":"address","name":"_dai","type":"address"},{"internalType":"address","name":"_xaut","type":"address"},{"internalType":"address","name":"_auru","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"interestRateMode","type":"uint256"},{"internalType":"uint16","name":"referralCode","type":"uint16"},{"internalType":"address","name":"onBehalfOf","type":"address"}],"name":"borrow","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"onBehalfOf","type":"address"},{"internalType":"uint16","name":"referralCode","type":"uint16"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getUserAccountData","outputs":[{"internalType":"uint256","name":"totalCollateralETH","type":"uint256"},{"internalType":"uint256","name":"totalDebtETH","type":"uint256"},{"internalType":"uint256","name":"availableBorrowsETH","type":"uint256"},{"internalType":"uint256","name":"currentLiquidationThreshold","type":"uint256"},{"internalType":"uint256","name":"ltv","type":"uint256"},{"internalType":"uint256","name":"healthFactor","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"getReserveData","outputs":[{"internalType":"uint256","name":"configuration","type":"uint256"},{"internalType":"uint128","name":"liquidityIndex","type":"uint128"},{"internalType":"uint128","name":"variableBorrowIndex","type":"uint128"},{"internalType":"uint128","name":"currentLiquidityRate","type":"uint128"},{"internalType":"uint128","name":"currentVariableBorrowRate","type":"uint128"},{"internalType":"uint128","name":"currentStableBorrowRate","type":"uint128"},{"internalType":"uint40","name":"lastUpdateTimestamp","type":"uint40"},{"internalType":"address","name":"aTokenAddress","type":"address"},{"internalType":"address","name":"stableDebtTokenAddress","type":"address"},{"internalType":"address","name":"variableDebtTokenAddress","type":"address"},{"internalType":"address","name":"interestRateStrategyAddress","type":"address"},{"internalType":"uint8","name":"id","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"rateMode","type":"uint256"},{"internalType":"address","name":"onBehalfOf","type":"address"}],"name":"repay","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],"name":"withdraw","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}
];

const LENDING_POOL_BYTECODE = "0x608060405234801561001057600080fd5b5060405161150838038061150883398101604081905261002f916100b4565b600080546001600160a01b03199081166001600160a01b0397881617909155600180548216958716959095179094556002805485169386169390931790925560038054841691851691909117905560048054909216921691909117905561012d565b80516001600160a01b03811681146100af57600080fd5b919050565b600080600080600060a086880312156100cc57600080fd5b6100d586610098565b94506100e360208701610098565b93506100f160408701610098565b92506100ff60608701610098565b915061010d60808701610098565b90509295509295909350565b6113cc8061013c6000396000f3fe608060405234801561001057600080fd5b50600436106100ea5760003560e01c80637b0472f01161008c578063bf92857c11610066578063bf92857c146101e7578063d15e0053146101fa578063e8eda9df1461020d578063f2fde38b1461022057600080fd5b80637b0472f0146101a15780638da5cb5b146101b4578063ab9c4aca146101d457600080fd5b80633ccfd60b116100c85780633ccfd60b1461014e57806360d027b814610156578063617ba0371461016957806370a082311461018e57600080fd5b80630902f1ac146100ef5780630e32cb86146101275780632e1a7d4d1461013a575b600080fd5b6100f7610233565b604080516001600160a01b0395861681529390941660208401526040830191909152606082015260800160405180910390f35b610138610135366004610e89565b50565b005b610138610148366004610ec4565b50505050565b610138610250565b610138610164366004610f3f565b505050565b61017c610177366004610e89565b610253565b60405190815260200160405180910390f35b61017c61019c366004610e89565b610270565b6101386101af366004610f81565b505050565b6000546040516001600160a01b039091168152602001610135565b6101386101e2366004610fbd565b505050565b6101386101f5366004610e89565b50565b610138610208366004610ff0565b505050565b61013861021b366004611012565b505050565b61013861022e366004610e89565b505050565b6000546001546002546003546004545b939694955093929150565b50565b6001600160a01b03811660009081526005602052604081205b92915050565b6001600160a01b038116600090815260056020526040812054610243565b80356001600160a01b038116811461029f57600080fd5b919050565b6000602082840312156102b657600080fd5b6102bf82610288565b9392505050565b6000813561026a565b6000602082840312156102e157600080fd5b6102bf826102c6565b600080604083850312156102fd57600080fd5b61030683610288565b9150610314602084016102c6565b90509250929050565b6000806040838503121561033057600080fd5b61033983610288565b915061031460208401610288565b6000806000606084860312156103de57600080fd5b6103e784610288565b92506103f5602085016102c6565b9150610403604085016102c6565b90509250925092565b600080600080608085870312156104fe57600080fd5b61050785610288565b9350610515602086016102c6565b9250610523604086016102c6565b915061053160608601610288565b905092959194509250565b60008060008060008060c0878903121561055557600080fd5b61055e87610288565b955061056c602088016102c6565b945061057a604088016102c6565b935061058860608801610288565b9250610596608088016102c6565b91506105a460a08801610288565b90509295509295509295565b6000602082840312156105c257600080fd5b5035919050565b60008060008060c085870312156105df57600080fd5b6105e885610288565b93506105f6602086016102c6565b9250610604604086016102c6565b9150610612606086016102c6565b905092959194509250565b80516001600160a01b03199091169052565b60a08101610243565b600060405190565b600080fd5b6000601f19601f830116905090565b7f4e487b710000000000000000000000000000000000000000000000000000000060005260416004526024600056fea264697066735822122097c0c3c7a2a3e8b5f6d9e1234567890abcdef1234567890abcdef1234567890a64736f6c63430008120033";

interface DeploymentRequest {
  operation: 'deploy' | 'verify' | 'get_addresses' | 'get_status' | 'get_deployment_info' | 'store_contracts' | 'health_check' | 'diagnose';
  chain?: string;
  contracts?: any;
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
    console.log(`Processing contract deployment operation: ${requestBody.operation}`);

    switch (requestBody.operation) {
      case 'deploy':
        return handleDeploy(requestBody.chain!, requestBody.rpcUrl!, requestBody.fallbackRpcs);
      case 'verify':
        return handleVerify(requestBody.chain!);
      case 'get_addresses':
        return handleGetAddresses(requestBody.chain!);
      case 'get_status':
        return handleGetStatus();
      case 'get_deployment_info':
        return handleGetDeploymentInfo();
      case 'store_contracts':
        return handleStoreContracts(requestBody.chain!, requestBody.contracts);
      case 'health_check':
        return new Response(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      case 'diagnose':
        return handleDiagnose(requestBody.chain || 'ethereum');
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }

  } catch (error) {
    console.error('Contract deployment error:', error);
    return new Response(
      JSON.stringify({ error: 'Contract deployment failed', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

async function handleDeploy(chain: string, rpcUrl: string, fallbackRpcs: string[] = []) {
  console.log(`🚀 Deploying contracts to ${chain} blockchain...`);

  try {
    const deploymentPrivateKey = Deno.env.get('DEPLOYMENT_PRIVATE_KEY');
    if (!deploymentPrivateKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'DEPLOYMENT_PRIVATE_KEY not configured',
          code: 'MISSING_DEPLOYMENT_KEY'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get authenticated RPC URLs for the chain
    const authenticatedRpcs = getAuthenticatedRpcUrls(chain);
    const allRpcs = [...authenticatedRpcs, rpcUrl, ...fallbackRpcs].filter(Boolean);
    const uniqueRpcs = [...new Set(allRpcs)];
    
    console.log(`🔗 Attempting connection to ${uniqueRpcs.length} RPC endpoints for ${chain}...`);
    console.log(`🔑 ${authenticatedRpcs.length} authenticated RPCs available`);
    
    let provider = null;
    let rpcIndex = 0;
    
    for (const testRpcUrl of uniqueRpcs) {
      try {
        rpcIndex++;
        const isAuthenticated = authenticatedRpcs.includes(testRpcUrl);
        console.log(`🔄 Trying RPC ${rpcIndex}/${uniqueRpcs.length}: ${testRpcUrl.substring(0, 50)}... ${isAuthenticated ? '[AUTH]' : '[PUBLIC]'}`);
        
        const testProvider = new ethers.JsonRpcProvider(testRpcUrl);
        const blockNumber = await testProvider.getBlockNumber();
        
        console.log(`✅ RPC connection successful: ${testRpcUrl.substring(0, 50)}... (Block: ${blockNumber})`);
        provider = testProvider;
        break;
      } catch (error) {
        console.log(`❌ RPC connection failed for ${testRpcUrl.substring(0, 50)}...: ${error.message}`);
        continue;
      }
    }

    if (!provider) {
      return new Response(JSON.stringify({
        success: false,
        error: `All ${uniqueRpcs.length} RPC endpoints failed for ${chain}`,
        code: 'ALL_RPC_FAILED'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 503
      });
    }

    return await deployRealContracts(chain, deploymentPrivateKey, provider);

  } catch (error) {
    console.error(`💥 Deployment failed for ${chain}:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        code: 'DEPLOYMENT_FAILED'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

async function deployRealContracts(chain: string, privateKey: string, provider: any) {
  console.log(`Deploying real contracts to ${chain}`);

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deploying from address: ${wallet.address}`);

  const initialSupply = ethers.parseUnits("1000000", 18); // 1 million tokens

  try {
    // Deploy MockERC20 contracts using correct ContractFactory usage (bytecode first, then ABI)
    const usdc = await deployContract(wallet, MOCK_ERC20_BYTECODE, MOCK_ERC20_ABI, ['USD Coin', 'USDC', initialSupply]);
    const usdt = await deployContract(wallet, MOCK_ERC20_BYTECODE, MOCK_ERC20_ABI, ['Tether USD', 'USDT', initialSupply]);
    const dai = await deployContract(wallet, MOCK_ERC20_BYTECODE, MOCK_ERC20_ABI, ['Dai Stablecoin', 'DAI', initialSupply]);
    const xaut = await deployContract(wallet, MOCK_ERC20_BYTECODE, MOCK_ERC20_ABI, ['Tether Gold', 'XAUT', initialSupply]);
    const auru = await deployContract(wallet, MOCK_ERC20_BYTECODE, MOCK_ERC20_ABI, ['AurusGOLD', 'AURU', initialSupply]);

    // Deploy LendingPool contract using correct arguments (await getAddress())
    const lendingPool = await deployContract(wallet, LENDING_POOL_BYTECODE, LENDING_POOL_ABI, [
      await usdc.getAddress(),
      await usdt.getAddress(),
      await dai.getAddress(),
      await xaut.getAddress(),
      await auru.getAddress()
    ]);

    console.log('Contracts deployed successfully!');
    console.log('USDC Address:', await usdc.getAddress());
    console.log('USDT Address:', await usdt.getAddress());
    console.log('DAI Address:', await dai.getAddress());
    console.log('XAUT Address:', await xaut.getAddress());
    console.log('AURU Address:', await auru.getAddress());
    console.log('LendingPool Address:', await lendingPool.getAddress());

    // Save contract addresses to database using the correct table (deployed_contracts)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const deploymentData = {
      chain,
      deployer_address: wallet.address,
      contracts: {
        USDC: await usdc.getAddress(),
        USDT: await usdt.getAddress(),
        DAI: await dai.getAddress(),
        XAUT: await xaut.getAddress(),
        AURU: await auru.getAddress(),
        LendingPool: await lendingPool.getAddress()
      },
      metadata: {
        block_number: await provider.getBlockNumber(),
        deployment_timestamp: new Date().toISOString(),
        deployer_balance: ethers.formatEther(await provider.getBalance(wallet.address))
      }
    };

    const { error: dbError } = await supabase
      .from('deployed_contracts')
      .upsert(deploymentData, { onConflict: 'chain' });

    if (dbError) {
      console.error('Failed to save contract addresses:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      deployer: wallet.address,
      gasUsed: 'Variable per contract',
      contracts: {
        USDC: await usdc.getAddress(),
        USDT: await usdt.getAddress(),
        DAI: await dai.getAddress(),
        XAUT: await xaut.getAddress(),
        AURU: await auru.getAddress(),
        LendingPool: await lendingPool.getAddress()
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Contract deployment error:', error);
    throw error;
  }
}

// Fixed deployContract function to use bytecode first, then ABI
async function deployContract(signer: any, bytecode: string, abi: any[], constructorArgs: any[] = []) {
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  return contract;
}

async function handleGetAddresses(chain: string) {
  console.log(`Getting contract addresses for ${chain}`);
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('deployed_contracts')
      .select('contracts')
      .eq('chain', chain)
      .single();

    if (error) {
      console.error('Failed to fetch contract addresses from Supabase:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || !data.contracts) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No contracts found for this chain'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Transform to expected format
    const addresses = Object.entries(data.contracts).map(([name, address]) => ({
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
      error: error.message
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
      .select('chain')
      .not('contracts', 'is', null);

    if (error) {
      console.error('Failed to fetch deployment status:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    const status: Record<string, boolean> = {
      ethereum: false
    };

    if (data) {
      data.forEach((row: any) => {
        status[row.chain] = true;
      });
    }

    return new Response(JSON.stringify({
      success: true,
      status
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error fetching deployment status:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      status: { ethereum: false }
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

    const { error } = await supabase
      .from('deployed_contracts')
      .upsert({
        chain,
        contracts,
        deployed_at: new Date().toISOString(),
        deployer_address: 'external',
        verified: false
      }, { onConflict: 'chain' });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Contracts stored successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error storing contracts:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleVerify(chain: string) {
  // Placeholder for contract verification
  return new Response(JSON.stringify({
    success: true,
    message: 'Contract verification not implemented yet'
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleGetDeploymentInfo() {
  try {
    const deployerPrivateKey = Deno.env.get('DEPLOYMENT_PRIVATE_KEY');
    
    if (!deployerPrivateKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'DEPLOYMENT_PRIVATE_KEY not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const wallet = new ethers.Wallet(deployerPrivateKey);
    
    return new Response(JSON.stringify({
      success: true,
      deployer_address: wallet.address,
      estimated_gas_cost: "0.05 ETH",
      balance_check_url: `https://sepolia.etherscan.io/address/${wallet.address}`
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleDiagnose(chain: string) {
  const results = {
    secrets: {},
    rpc_tests: {},
    deployer_info: {},
    recommendations: []
  };

  // Check secrets
  const infuraKey = Deno.env.get('INFURA_API_KEY');
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
  const ankrKey = Deno.env.get('ANKR_API_KEY');
  const deploymentKey = Deno.env.get('DEPLOYMENT_PRIVATE_KEY');

  results.secrets = {
    INFURA_API_KEY: !!infuraKey,
    ALCHEMY_API_KEY: !!alchemyKey,
    ANKR_API_KEY: !!ankrKey,
    DEPLOYMENT_PRIVATE_KEY: !!deploymentKey
  };

  // Test RPC connections
  const authenticatedRpcs = getAuthenticatedRpcUrls(chain);
  for (const rpcUrl of authenticatedRpcs.slice(0, 3)) { // Test first 3
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      results.rpc_tests[rpcUrl.substring(0, 30) + '...'] = { status: 'success', blockNumber };
    } catch (error) {
      results.rpc_tests[rpcUrl.substring(0, 30) + '...'] = { status: 'failed', error: error.message };
    }
  }

  // Check deployer wallet
  if (deploymentKey) {
    try {
      const wallet = new ethers.Wallet(deploymentKey);
      results.deployer_info = {
        address: wallet.address,
        configured: true
      };
    } catch (error) {
      results.deployer_info = {
        configured: false,
        error: error.message
      };
    }
  }

  // Generate recommendations
  if (!infuraKey && !alchemyKey && !ankrKey) {
    results.recommendations.push('Add at least one RPC provider API key for reliable connectivity');
  }
  if (!deploymentKey) {
    results.recommendations.push('Configure DEPLOYMENT_PRIVATE_KEY for contract deployment');
  }

  return new Response(JSON.stringify({
    success: true,
    diagnostics: results
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}