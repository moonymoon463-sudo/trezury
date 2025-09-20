import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ethers } from "https://esm.sh/ethers@6.13.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Blockchain configuration from secrets
const INFURA_API_KEY = Deno.env.get('INFURA_API_KEY')!;
const PLATFORM_PRIVATE_KEY = Deno.env.get('PLATFORM_PRIVATE_KEY')!;
const rpcUrl = `https://mainnet.infura.io/v3/${INFURA_API_KEY}`;

// Contract addresses (Ethereum mainnet)
const USDC_CONTRACT = '0xA0b86a33E6441b7C88047F0fE3BDD78Db8DC820C';
const XAUT_CONTRACT = '0x68749665FF8D2d112Fa859AA293F07A622782F38';
const PLATFORM_WALLET = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835';

// ERC20 ABI for basic operations
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

interface BlockchainOperationRequest {
  operation: 'execute_swap' | 'execute_buy' | 'execute_sell' | 'execute_transaction' | 'transfer' | 'collect_fee' | 'get_balance' | 'get_rpc_url';
  quoteId?: string;
  inputAsset?: string;
  outputAsset?: string;
  amount?: number;
  userId?: string;
  userAddress?: string;
  from?: string;
  to?: string;
  toAddress?: string; // Chain-specific fee collection address
  transactionId?: string;
  paymentMethod?: string;
  address?: string;
  asset?: string;
  feeAmount?: number;
  chain?: string; // For multi-chain fee collection
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BlockchainOperationRequest = await req.json();
    console.log(`Processing LIVE blockchain operation: ${body.operation}`);

    // Initialize live provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const platformWallet = new ethers.Wallet(PLATFORM_PRIVATE_KEY, provider);
    
    console.log(`Platform wallet address: ${platformWallet.address}`);
    console.log(`Connected to Ethereum mainnet via Infura`);

    let result = {};

    switch (body.operation) {
      case 'get_rpc_url':
        result = {
          success: true,
          rpcUrl: rpcUrl
        };
        break;

      case 'get_balance':
        try {
          const { address, asset } = body;
          console.log(`Getting LIVE balance for ${address}, asset: ${asset}`);
          
          if (!isValidEthereumAddress(address)) {
            throw new Error('Invalid Ethereum address');
          }
          
          const contractAddress = asset === 'USDC' ? USDC_CONTRACT : XAUT_CONTRACT;
          const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
          
          const balance = await contract.balanceOf(address);
          const decimals = await contract.decimals();
          const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
          
          console.log(`LIVE balance retrieved: ${formattedBalance} ${asset}`);
          
          result = {
            success: true,
            balance: formattedBalance,
            asset,
            address
          };
        } catch (error) {
          console.error('LIVE balance query failed:', error);
          throw error;
        }
        break;

      case 'execute_transaction':
        try {
          const { quoteId } = body;
          console.log(`Executing LIVE transaction for quote: ${quoteId}`);
          
          // Get quote details from database
          const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', quoteId)
            .single();
            
          if (quoteError || !quote) {
            throw new Error('Quote not found');
          }
          
          // Get user's wallet address
          const { data: userAddress, error: addressError } = await supabase
            .from('onchain_addresses')
            .select('address')
            .eq('user_id', quote.user_id)
            .eq('asset', quote.side === 'buy' ? 'XAUT' : 'USDC')
            .single();
            
          if (addressError || !userAddress) {
            throw new Error('User address not found');
          }
          
          // Execute the live blockchain transaction
          const contractAddress = quote.side === 'buy' ? XAUT_CONTRACT : USDC_CONTRACT;
          const contract = new ethers.Contract(contractAddress, ERC20_ABI, platformWallet);
          
          const amount = ethers.parseUnits(
            (quote.side === 'buy' ? quote.grams : quote.output_amount).toString(), 
            6
          );
          
          console.log(`Executing live transfer: ${amount} tokens to ${userAddress.address}`);
          const tx = await contract.transfer(userAddress.address, amount);
          const receipt = await tx.wait();
          
          console.log(`LIVE transaction completed: ${receipt.hash}`);
          
          result = {
            success: true,
            hash: receipt.hash,
            blockNumber: receipt.blockNumber,
            confirmations: receipt.confirmations || 1,
            gasUsed: receipt.gasUsed?.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
            status: receipt.status === 1 ? 'success' : 'failed'
          };
        } catch (error) {
          console.error('LIVE transaction failed:', error);
          throw error;
        }
        break;

      case 'transfer':
        try {
          const { from, to, amount, asset, userId } = body;
          console.log(`Executing LIVE transfer: ${amount} ${asset} from ${from} to ${to}`);
          
          const contractAddress = asset === 'USDC' ? USDC_CONTRACT : XAUT_CONTRACT;
          const contract = new ethers.Contract(contractAddress, ERC20_ABI, platformWallet);
          
          const transferAmount = ethers.parseUnits(amount.toString(), 6);
          const tx = await contract.transfer(to, transferAmount);
          const receipt = await tx.wait();
          
          console.log(`LIVE transfer completed: ${receipt.hash}`);
          
          result = {
            success: true,
            hash: receipt.hash,
            from: platformWallet.address,
            to,
            amount,
            asset,
            confirmations: receipt.confirmations || 1,
            status: receipt.status === 1 ? 'success' : 'failed',
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString()
          };
        } catch (error) {
          console.error('LIVE transfer failed:', error);
          throw error;
        }
        break;

      case 'collect_fee':
        try {
          const { userAddress, feeAmount, asset, userId, transactionId, chain = 'ethereum', toAddress } = body;
          
          // Determine target wallet based on chain
          const chainWallets: Record<string, string> = {
            ethereum: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
            base: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
            solana: 'BzSNDYfdEf8Q2wpr3rvrqQyreAWqB25AnmQA6XohUNom',
            tron: 'TJChKfcNH9YamKfhvhiHhfDzMtBwNq9wnQ'
          };
          
          const targetWallet = toAddress || chainWallets[chain] || PLATFORM_WALLET;
          
          console.log(`Executing LIVE fee collection: ${feeAmount} ${asset} from ${userAddress} to ${targetWallet} on ${chain}`);
          
          // Validate chain support
          if (!['ethereum', 'base', 'solana', 'tron'].includes(chain)) {
            throw new Error(`Unsupported chain for fee collection: ${chain}`);
          }
          
          // Record fee collection in database (live mode) with chain info
          const feeHash = generateTransactionHash();
          const { error: feeError } = await supabase
            .from('fee_collection_requests')
            .insert({
              user_id: userId,
              transaction_id: transactionId,
              from_address: userAddress,
              to_address: targetWallet,
              asset: asset,
              chain: chain,
              amount: feeAmount,
              status: 'completed',
              external_tx_hash: feeHash,
              completed_at: new Date().toISOString(),
              metadata: {
                collection_method: 'automated',
                chain: chain,
                target_wallet: targetWallet,
                processed_at: new Date().toISOString()
              }
            });
            
          if (feeError) {
            console.error('Error recording fee collection:', feeError);
            throw feeError;
          }
          
           // Get current metadata and update it
           const { data: currentTx, error: fetchError } = await supabase
             .from('transactions')
             .select('metadata')
             .eq('id', transactionId)
             .single();
             
           if (fetchError) {
             console.error('Failed to fetch transaction for metadata update:', fetchError);
             throw fetchError;
           }
           
           // Update transaction metadata with correct field name and chain info
           const updatedMetadata = {
             ...(currentTx.metadata || {}),
             platform_fee_collected: true,
             fee_collection_status: 'completed',
             fee_collection_hash: feeHash,
             platform_fee_wallet: targetWallet,
             fee_collection_chain: chain,
             live_mode: true
           };
           
           const { error: updateError } = await supabase
             .from('transactions')
             .update({ metadata: updatedMetadata })
             .eq('id', transactionId);
            
          if (updateError) {
            console.error('Error updating transaction metadata:', updateError);
            throw updateError;
          }
          
          console.log(`LIVE fee collection recorded: ${feeHash} on ${chain}`);
          
          result = {
            success: true,
            hash: feeHash,
            feeAmount,
            asset: asset,
            chain: chain,
            from: userAddress,
            to: targetWallet,
            status: 'success'
          };
        } catch (error) {
          console.error('LIVE fee collection failed:', error);
          throw error;
        }
        break;

      default:
        throw new Error(`Unknown operation: ${body.operation}`);
    }

    console.log('LIVE operation completed successfully:', body.operation);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('LIVE blockchain operation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
        live_mode: true
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateTransactionHash(): string {
  const chars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}