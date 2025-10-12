import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token addresses by chain
const TOKEN_ADDRESSES: Record<number, Record<string, string>> = {
  1: { // Ethereum
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    XAUT: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
    TRZRY: '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B',
    BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  42161: { // Arbitrum
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    XAUT: '0x40461291347e1ecbb09499f3371d3f17f10d7159', // Correct Arbitrum XAUT address
    BTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f'
  }
};

// Helper to get correct 0x API base URL for the chain
function getZeroXSwapBaseUrl(chainId: number): string {
  if (chainId === 1) {
    return 'https://api.0x.org';
  } else if (chainId === 42161) {
    return 'https://arbitrum.api.0x.org';
  }
  throw new Error(`Unsupported chainId: ${chainId}`);
}

serve(async (req) => {
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { operation, ...params } = await req.json();
    const ZERO_X_API_KEY = Deno.env.get('ZERO_X_API_KEY');
    
    if (!ZERO_X_API_KEY) {
      throw new Error('0x API key not configured');
    }

    if (operation === 'get_price') {
      const { sellToken, buyToken, sellAmount, chainId } = params;
      
      // Validate chain is supported
      const availableChains = Object.keys(TOKEN_ADDRESSES).map(Number);
      if (!availableChains.includes(chainId)) {
        console.error('Unsupported chain:', { chainId, availableChains });
        throw new Error(`Unsupported chain: ${chainId}. Available: ${availableChains.join(', ')}`);
      }
      
      // Strip _ARB suffix if present (for Arbitrum tokens)
      const cleanSellToken = sellToken.replace('_ARB', '');
      const cleanBuyToken = buyToken.replace('_ARB', '');
      
      const sellTokenAddress = TOKEN_ADDRESSES[chainId]?.[cleanSellToken];
      const buyTokenAddress = TOKEN_ADDRESSES[chainId]?.[cleanBuyToken];

      console.log('Indicative price token mapping:', {
        sellToken: `${sellToken} -> ${cleanSellToken} -> ${sellTokenAddress}`,
        buyToken: `${buyToken} -> ${cleanBuyToken} -> ${buyTokenAddress}`,
        chainId,
        availableTokens: Object.keys(TOKEN_ADDRESSES[chainId] || {})
      });

      if (!sellTokenAddress || !buyTokenAddress) {
        console.error('Token not found:', { 
          chainId, 
          cleanSellToken, 
          cleanBuyToken,
          availableTokens: Object.keys(TOKEN_ADDRESSES[chainId] || {})
        });
        throw new Error(`Token not supported on chain ${chainId}: ${cleanSellToken} or ${cleanBuyToken}`);
      }

      const queryParams = new URLSearchParams({
        sellToken: sellTokenAddress,
        buyToken: buyTokenAddress,
        sellAmount: sellAmount,
        slippagePercentage: '0.005',
        buyTokenPercentageFee: '0.008',
        feeRecipient: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835'
      });

      const baseUrl = getZeroXSwapBaseUrl(chainId);
      const priceUrl = `${baseUrl}/swap/v1/price?${queryParams}`;
      
      console.log('Fetching indicative price from 0x:', {
        chainId,
        baseUrl,
        fullUrl: priceUrl,
        sellToken: `${sellToken} -> ${sellTokenAddress}`,
        buyToken: `${buyToken} -> ${buyTokenAddress}`,
        sellAmount
      });

      const response = await fetch(priceUrl, {
        headers: {
          '0x-api-key': ZERO_X_API_KEY
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        const requestId = response.headers.get('x-request-id');
        console.error('0x price API error:', {
          status: response.status,
          statusText: response.statusText,
          requestUrl: priceUrl,
          requestId,
          body: errorText
        });
        throw new Error(`0x price API error (${response.status}): ${errorText}`);
      }

      const price = await response.json();
      console.log('Indicative price received:', { buyAmount: price.buyAmount, price: price.price });

      return new Response(
        JSON.stringify({ success: true, price }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'get_quote') {
      const { sellToken, buyToken, sellAmount, userAddress, chainId } = params;
      
      // Validate chain is supported
      const availableChains = Object.keys(TOKEN_ADDRESSES).map(Number);
      if (!availableChains.includes(chainId)) {
        console.error('Unsupported chain:', { chainId, availableChains });
        throw new Error(`Unsupported chain: ${chainId}. Available: ${availableChains.join(', ')}`);
      }
      
      // Strip _ARB suffix if present (for Arbitrum tokens)
      const cleanSellToken = sellToken.replace('_ARB', '');
      const cleanBuyToken = buyToken.replace('_ARB', '');
      
      const sellTokenAddress = TOKEN_ADDRESSES[chainId]?.[cleanSellToken];
      const buyTokenAddress = TOKEN_ADDRESSES[chainId]?.[cleanBuyToken];

      console.log('Token mapping:', {
        sellToken: `${sellToken} -> ${cleanSellToken} -> ${sellTokenAddress}`,
        buyToken: `${buyToken} -> ${cleanBuyToken} -> ${buyTokenAddress}`,
        chainId,
        availableTokens: Object.keys(TOKEN_ADDRESSES[chainId] || {})
      });

      if (!sellTokenAddress || !buyTokenAddress) {
        console.error('Token not found:', { 
          chainId, 
          cleanSellToken, 
          cleanBuyToken,
          availableTokens: Object.keys(TOKEN_ADDRESSES[chainId] || {})
        });
        throw new Error(`Token not supported on chain ${chainId}: ${cleanSellToken} or ${cleanBuyToken}`);
      }

      const queryParams = new URLSearchParams({
        chainId: chainId.toString(),
        sellToken: sellTokenAddress,
        buyToken: buyTokenAddress,
        sellAmount: sellAmount,
        taker: userAddress,
        swapFeeRecipient: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
        swapFeeBps: '80', // 0.8% platform fee
        swapFeeToken: buyTokenAddress,
        tradeSurplusRecipient: userAddress
      });

      const baseUrl = getZeroXSwapBaseUrl(chainId);
      const quoteUrl = `${baseUrl}/gasless/quote?${queryParams}`;
      
      console.log('Constructing 0x API request:', {
        chainId,
        baseUrl,
        fullUrl: quoteUrl,
        sellToken: `${sellToken} -> ${sellTokenAddress}`,
        buyToken: `${buyToken} -> ${buyTokenAddress}`,
        sellAmount,
        userAddress,
        swapFeeToken: buyTokenAddress
      });

      const response = await fetch(quoteUrl, {
        headers: {
          '0x-api-key': ZERO_X_API_KEY,
          '0x-version': 'v2'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        const requestId = response.headers.get('x-request-id');
        console.error('0x API error details:', {
          status: response.status,
          statusText: response.statusText,
          requestUrl: quoteUrl,
          requestId,
          body: errorText,
          requestParams: {
            chainId,
            sellToken: sellTokenAddress,
            buyToken: buyTokenAddress,
            swapFeeToken: buyTokenAddress
          }
        });
        throw new Error(`0x API error (${response.status}): ${errorText}`);
      }

      const quote = await response.json();
      console.log('Quote received:', { buyAmount: quote.buyAmount, chainId: quote.chainId });

      return new Response(
        JSON.stringify({ success: true, quote }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'submit_swap') {
      const { quote, signature, quoteId, intentId } = params;

      console.log('Submitting gasless swap to 0x');

      const response = await fetch('https://api.0x.org/gasless/submit', {
        method: 'POST',
        headers: {
          '0x-api-key': ZERO_X_API_KEY,
          '0x-version': 'v2',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chainId: quote.chainId,
          quote,
          signature,
          quoteId,
          intentId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('0x submit error:', errorText);
        throw new Error(`Failed to submit: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Swap submitted:', { tradeHash: result.tradeHash });

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'get_status') {
      const { tradeHash } = params;

      const response = await fetch(`https://api.0x.org/gasless/status/${tradeHash}`, {
        headers: {
          '0x-api-key': ZERO_X_API_KEY,
          '0x-version': 'v2'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('0x status error:', errorText);
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const status = await response.json();

      return new Response(
        JSON.stringify({ success: true, status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown operation: ${operation}`);

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
