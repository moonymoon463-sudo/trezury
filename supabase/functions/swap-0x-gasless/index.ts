/**
 * 0x Gasless Swap Edge Function
 * Ethereum mainnet only (chainId = 1)
 * 
 * Operations: self_test, get_price, get_quote, submit_swap, get_status
 * 
 * Uses node-fetch for better TLS certificate handling in Deno runtime
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
// @ts-ignore - npm module
import fetch from 'npm:node-fetch@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform fee configuration (MUST be an EOA)
const PLATFORM_FEE_RECIPIENT = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835';
const PLATFORM_FEE_BPS = 80; // 0.8%
const DEFAULT_FEE_TOKEN_STRATEGY: 'buy' | 'sell' = 'buy';

// Ethereum mainnet only
const ETHEREUM_CHAIN_ID = 1;
const ZERO_X_API_BASE = 'https://api.0x.org';

// Ethereum token addresses
const TOKEN_ADDRESSES: Record<string, string> = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  XAUT: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
  TRZRY: '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B',
  BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
};

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
      return new Response(
        JSON.stringify({ success: false, error: 'unauthorized', message: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { operation, ...params } = await req.json();
    // Get 0x API key from environment (check both standard and VITE_ prefix)
    const ZERO_X_API_KEY = Deno.env.get('ZERO_X_API_KEY') || Deno.env.get('VITE_ZERO_X_API_KEY');
    
    if (!ZERO_X_API_KEY || ZERO_X_API_KEY === 'your_0x_api_key_here') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'missing_api_key',
          message: '0x API key not configured. Contact support.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`🔧 Operation: ${operation}, User: ${user.id.substring(0, 8)}...`);

    // ========== SELF TEST ==========
    if (operation === 'self_test') {
      const testResults: any = {
        success: true,
        chainId: ETHEREUM_CHAIN_ID,
        apiKeyPresent: true,
        tests: {}
      };

      try {
        // Test /gasless/price endpoint
        const priceUrl = `${ZERO_X_API_BASE}/gasless/price?${new URLSearchParams({
          chainId: String(ETHEREUM_CHAIN_ID),
          sellToken: TOKEN_ADDRESSES.USDC,
          buyToken: TOKEN_ADDRESSES.WETH,
          sellAmount: '1000000', // 1 USDC
          slippageBps: '50',
          swapFeeRecipient: PLATFORM_FEE_RECIPIENT,
          swapFeeBps: String(PLATFORM_FEE_BPS),
          swapFeeToken: TOKEN_ADDRESSES.WETH
        })}`;

        console.log('📡 Price URL:', priceUrl);
        const priceResponse = await fetch(priceUrl, {
          headers: { '0x-api-key': ZERO_X_API_KEY, '0x-version': 'v2' }
        });

        testResults.tests.price = {
          endpoint: '/gasless/price',
          status: priceResponse.status,
          success: priceResponse.ok,
          requestId: priceResponse.headers.get('x-request-id')
        };

        if (!priceResponse.ok) {
          testResults.tests.price.error = await priceResponse.text();
        }

        // Test /gasless/quote endpoint
        const quoteParams: Record<string, string> = {
          chainId: String(ETHEREUM_CHAIN_ID),
          sellToken: TOKEN_ADDRESSES.USDC,
          buyToken: TOKEN_ADDRESSES.WETH,
          sellAmount: '1000000',
          taker: '0x0000000000000000000000000000000000000001',
          slippageBps: '50',
          swapFeeRecipient: PLATFORM_FEE_RECIPIENT,
          swapFeeBps: String(PLATFORM_FEE_BPS),
          swapFeeToken: TOKEN_ADDRESSES.WETH
        };

        // Only add tradeSurplusRecipient if explicitly enabled
        if (Deno.env.get('ENABLE_TRADE_SURPLUS') === 'true') {
          quoteParams.tradeSurplusRecipient = '0x0000000000000000000000000000000000000001';
        }

        const quoteUrl = `${ZERO_X_API_BASE}/gasless/quote?${new URLSearchParams(quoteParams)}`;

        console.log('📡 Quote URL:', quoteUrl);
        const quoteResponse = await fetch(quoteUrl, {
          headers: { '0x-api-key': ZERO_X_API_KEY, '0x-version': 'v2' }
        });

        testResults.tests.quote = {
          endpoint: '/gasless/quote',
          status: quoteResponse.status,
          success: quoteResponse.ok,
          requestId: quoteResponse.headers.get('x-request-id')
        };

        if (!quoteResponse.ok) {
          testResults.tests.quote.error = await quoteResponse.text();
        }

        return new Response(
          JSON.stringify(testResults),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'self_test_failed',
            message: error.message,
            tests: testResults.tests
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // ========== GET PRICE ==========
    if (operation === 'get_price') {
      const { sellToken, buyToken, sellAmount, feeTokenStrategy } = params;
      
      if (!sellToken || !buyToken || !sellAmount) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'missing_parameters',
            message: 'sellToken, buyToken, and sellAmount are required'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const strategy = feeTokenStrategy || DEFAULT_FEE_TOKEN_STRATEGY;
      const swapFeeToken = strategy === 'sell' ? sellToken : buyToken;

      console.log('💰 Fee Configuration:', {
        recipient: PLATFORM_FEE_RECIPIENT,
        bps: PLATFORM_FEE_BPS,
        strategy,
        feeToken: swapFeeToken
      });

      try {
        const url = `${ZERO_X_API_BASE}/gasless/price?${new URLSearchParams({
          chainId: String(ETHEREUM_CHAIN_ID),
          sellToken,
          buyToken,
          sellAmount,
          slippageBps: '50',
          swapFeeRecipient: PLATFORM_FEE_RECIPIENT,
          swapFeeBps: String(PLATFORM_FEE_BPS),
          swapFeeToken
        })}`;

        console.log('📡 Fetching price from 0x...', url);
        const response = await fetch(url, {
          headers: { '0x-api-key': ZERO_X_API_KEY, '0x-version': 'v2' }
        });

        const requestId = response.headers.get('x-request-id');
        console.log(`📡 0x Response: ${response.status}, requestId: ${requestId}`);

        if (!response.ok) {
          const errorText = await response.text();
          const requestId = response.headers.get('x-request-id');
          console.error('❌ 0x API Error:', errorText, 'Request ID:', requestId);
          
          let errorBody;
          try {
            errorBody = JSON.parse(errorText);
          } catch {
            errorBody = { message: errorText };
          }
          
          return new Response(
            JSON.stringify({
              success: false,
              error: 'api_error',
              message: `0x API error: ${response.status}`,
              details: errorBody,
              requestId,
              code: response.status
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const quote = await response.json();
        
        return new Response(
          JSON.stringify({ success: true, quote, requestId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (error: any) {
        console.error('❌ Price fetch error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'fetch_failed',
            message: error.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // ========== GET QUOTE ==========
    if (operation === 'get_quote') {
      const { sellToken, buyToken, sellAmount, userAddress, feeTokenStrategy, includedSources, excludedSources } = params;
      
      if (!sellToken || !buyToken || !sellAmount || !userAddress) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'missing_parameters',
            message: 'sellToken, buyToken, sellAmount, and userAddress are required'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const strategy = feeTokenStrategy || DEFAULT_FEE_TOKEN_STRATEGY;
      const swapFeeToken = strategy === 'sell' ? sellToken : buyToken;

      console.log('💰 Fee Configuration:', {
        recipient: PLATFORM_FEE_RECIPIENT,
        bps: PLATFORM_FEE_BPS,
        strategy,
        feeToken: swapFeeToken
      });

      try {
        const queryParams: Record<string, string> = {
          chainId: String(ETHEREUM_CHAIN_ID),
          sellToken,
          buyToken,
          sellAmount,
          taker: userAddress,
          slippageBps: '50',
          swapFeeRecipient: PLATFORM_FEE_RECIPIENT,
          swapFeeBps: String(PLATFORM_FEE_BPS),
          swapFeeToken
        };

        // Only add tradeSurplusRecipient if explicitly enabled
        if (Deno.env.get('ENABLE_TRADE_SURPLUS') === 'true') {
          queryParams.tradeSurplusRecipient = PLATFORM_FEE_RECIPIENT;
        }

        if (includedSources && includedSources.length > 0) {
          queryParams.includedSources = includedSources.join(',');
        }
        if (excludedSources && excludedSources.length > 0) {
          queryParams.excludedSources = excludedSources.join(',');
        }

        const url = `${ZERO_X_API_BASE}/gasless/quote?${new URLSearchParams(queryParams)}`;

        console.log('📡 Fetching quote from 0x...', url);
        const response = await fetch(url, {
          headers: { '0x-api-key': ZERO_X_API_KEY, '0x-version': 'v2' }
        });

        const requestId = response.headers.get('x-request-id');
        console.log(`📡 0x Response: ${response.status}, requestId: ${requestId}`);

        if (!response.ok) {
          const errorText = await response.text();
          const requestId = response.headers.get('x-request-id');
          console.error('❌ 0x API Error:', errorText, 'Request ID:', requestId);
          
          let errorBody;
          try {
            errorBody = JSON.parse(errorText);
          } catch {
            errorBody = { message: errorText };
          }
          
          return new Response(
            JSON.stringify({
              success: false,
              error: 'api_error',
              message: `0x API error: ${response.status}`,
              details: errorBody,
              requestId,
              code: response.status,
              hint: response.status === 400 ? 'requote_and_resign' : undefined
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const quote = await response.json();
        
        console.log('📊 Quote details:', {
          allowanceTarget: quote.allowanceTarget,
          hasApproval: !!quote.approval,
          hasTrade: !!quote.trade,
          issues: quote.issues
        });

        console.log('💰 Fee breakdown:', {
          integratorFee: quote.fees?.integratorFee,
          zeroExFee: quote.fees?.zeroExFee,
          gasFee: quote.fees?.gasFee
        });

        // CRITICAL: Only block on balance issues
        // issues.allowance is informational in gasless v2 - approval payload will be present if needed
        if (quote.issues?.balance) {
          console.error('❌ Insufficient balance:', quote.issues.balance);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'insufficient_balance',
              message: `Insufficient balance. Expected: ${quote.issues.balance.expected}, Actual: ${quote.issues.balance.actual}`,
              details: quote.issues.balance,
              requestId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Validate approval payload presence if allowance issue exists
        if (quote.issues?.allowance) {
          console.log('ℹ️ Approval required:', quote.issues.allowance);
          
          if (!quote.approval) {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'missing_approval_payload',
                message: '0x API did not return approval EIP-712 data. Try a different amount.',
                details: quote.issues.allowance,
                requestId
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
          
          console.log('✅ Approval payload present');
        }

        return new Response(
          JSON.stringify({ success: true, quote, requestId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (error: any) {
        console.error('❌ Quote fetch error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'fetch_failed',
            message: error.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // ========== SUBMIT SWAP ==========
    if (operation === 'submit_swap') {
      const { quote, signatures, quoteId, intentId } = params;
      
      if (!quote || !signatures || !signatures.trade) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'missing_parameters',
            message: 'quote, signatures.trade are required'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Validate approval signature if quote has approval payload
      if (quote.approval && !signatures.approval) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'missing_approval_signature',
            message: 'Approval signature required but not provided'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      console.log('📤 Submitting swap to 0x...');
      console.log('🔏 Signatures:', {
        hasApproval: !!signatures.approval,
        hasTrade: !!signatures.trade
      });

      try {
        const body: any = {
          trade: {
            ...quote.trade,
            signature: signatures.trade,
            signatureType: 2 // EIP-712
          }
        };

        if (signatures.approval && quote.approval) {
          body.approval = {
            ...quote.approval,
            signature: signatures.approval,
            signatureType: 2
          };
        }

        const url = `${ZERO_X_API_BASE}/gasless/submit`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            '0x-api-key': ZERO_X_API_KEY,
            '0x-version': 'v2',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const requestId = response.headers.get('x-request-id');
        const zid = response.headers.get('x-zid');
        console.log(`📡 Submit Response: ${response.status}, requestId: ${requestId}, zid: ${zid}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Submit Error:', errorText);
          
          let parsedError: any = {};
          try {
            parsedError = JSON.parse(errorText);
          } catch {
            parsedError = { message: errorText };
          }

          const errorMessage = parsedError.message || parsedError.name || errorText;
          
          // Enhanced gas estimation error detection
          const isGasEstimationFailed = 
            errorMessage.toLowerCase().includes('gas estimation failed') ||
            errorMessage.toLowerCase().includes('could not estimate gas') ||
            errorMessage.toLowerCase().includes('simulation failed') ||
            errorMessage.toLowerCase().includes('gas required exceeds allowance') ||
            parsedError.name === 'GAS_ESTIMATION_FAILED';

          if (isGasEstimationFailed) {
            console.error('❌ Gas estimation failed');
            return new Response(
              JSON.stringify({
                success: false,
                error: 'gas_estimation_failed',
                message: errorMessage,
                details: parsedError.data?.details,
                requestId,
                zid,
                code: response.status,
                hint: 'requote_and_resign'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          // Check for stale signature
          const isStaleSignature = 
            errorMessage.toLowerCase().includes('stale') ||
            errorMessage.toLowerCase().includes('expired') ||
            errorMessage.toLowerCase().includes('invalid signature');

          if (isStaleSignature) {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'stale_or_invalid_signature',
                message: errorMessage,
                details: parsedError.data?.details,
                requestId,
                zid,
                code: response.status,
                hint: 'requote_and_resign'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          // Generic submit error
          return new Response(
            JSON.stringify({
              success: false,
              error: 'submit_failed',
              message: errorMessage,
              details: parsedError.data?.details,
              requestId,
              zid,
              code: response.status
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const result = await response.json();
        console.log('✅ Swap submitted:', result.tradeHash);

        return new Response(
          JSON.stringify({
            success: true,
            tradeHash: result.tradeHash,
            requestId,
            zid
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (error: any) {
        console.error('❌ Submit error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'submit_exception',
            message: error.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // ========== GET STATUS ==========
    if (operation === 'get_status') {
      const { tradeHash } = params;
      
      if (!tradeHash) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'missing_parameters',
            message: 'tradeHash is required'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      try {
        const url = `${ZERO_X_API_BASE}/gasless/status/${tradeHash}?chainId=${ETHEREUM_CHAIN_ID}`;
        
        const response = await fetch(url, {
          headers: { '0x-api-key': ZERO_X_API_KEY, '0x-version': 'v2' }
        });

        const requestId = response.headers.get('x-request-id');
        console.log(`📡 Status Response: ${response.status}, requestId: ${requestId}`);

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({
              success: false,
              error: 'status_check_failed',
              message: `Failed to get status: ${response.status}`,
              details: errorText,
              requestId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const status = await response.json();
        
        return new Response(
          JSON.stringify({ success: true, status, requestId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (error: any) {
        console.error('❌ Status check error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'status_exception',
            message: error.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Unknown operation
    return new Response(
      JSON.stringify({
        success: false,
        error: 'unknown_operation',
        message: `Unknown operation: ${operation}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Edge function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'server_error',
        message: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
