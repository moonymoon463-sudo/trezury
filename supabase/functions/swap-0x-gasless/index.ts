import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform fee configuration (MUST be an EOA)
const PLATFORM_FEE_RECIPIENT = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835'; // User confirmed EOA
const PLATFORM_FEE_BPS = 80; // 0.8%

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
    
    // Validate API key is configured
    if (!ZERO_X_API_KEY || ZERO_X_API_KEY === 'your_0x_api_key_here') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'missing_api_key',
          message: '0x API key not configured. Please add ZERO_X_API_KEY to Supabase secrets.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    // Log configuration status (without exposing full key)
    console.log('🔧 0x API Configuration:', {
      apiKeyConfigured: true,
      apiKeyLength: ZERO_X_API_KEY.length,
      platformFeeRecipient: PLATFORM_FEE_RECIPIENT,
      platformFeeBps: PLATFORM_FEE_BPS,
      feeRecipientIsEOA: true // User confirmed
    });

    if (operation === 'self_test') {
      const chainId = (params.chainId && Number(params.chainId)) || 1;
      const testAddress = params.testAddress || '0x0000000000000000000000000000000000000001';
      const sellTokenSymbol = 'USDC';
      const buyTokenSymbol = 'WETH';
      const sellTokenAddress = TOKEN_ADDRESSES[chainId]?.[sellTokenSymbol] || TOKEN_ADDRESSES[chainId]?.['USDC'];
      const buyTokenAddress = TOKEN_ADDRESSES[chainId]?.[buyTokenSymbol] || TOKEN_ADDRESSES[chainId]?.['ETH'];
      
      const results: any = {
        apiKeyPresent: true,
        chainId,
        tests: {}
      };
      
      try {
        if (!sellTokenAddress || !buyTokenAddress) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'token_not_found',
              message: `Token not supported on chain ${chainId}: ${sellTokenSymbol} or ${buyTokenSymbol}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
        
        const baseUrl = getZeroXSwapBaseUrl(chainId);
        
        // Test 1: Gasless Price
        try {
          const priceQs = new URLSearchParams({
            chainId: String(chainId),
            sellToken: sellTokenAddress,
            buyToken: buyTokenAddress,
            sellAmount: '1000000',
            swapFeeRecipient: PLATFORM_FEE_RECIPIENT,
            swapFeeBps: String(PLATFORM_FEE_BPS),
            swapFeeToken: buyTokenAddress
          });
          const priceUrl = `${baseUrl}/gasless/price?${priceQs}`;
          const priceResp = await fetch(priceUrl, { headers: { '0x-api-key': ZERO_X_API_KEY!, '0x-version': 'v2' } });
          const priceRequestId = priceResp.headers.get('x-request-id');
          const priceText = await priceResp.text();
          let priceJson: any = null;
          try { priceJson = JSON.parse(priceText); } catch {}
          
          results.tests.gaslessPrice = {
            ok: priceResp.ok,
            status: priceResp.status,
            requestId: priceRequestId,
            endpoint: '/gasless/price',
            body: priceResp.ok ? { buyAmount: priceJson?.buyAmount } : { error: priceJson?.message || priceText?.slice(0, 200) }
          };
        } catch (e: any) {
          results.tests.gaslessPrice = { ok: false, error: e.message };
        }
        
        // Test 2: Gasless Quote (with taker address)
        try {
          const quoteQs = new URLSearchParams({
            chainId: String(chainId),
            sellToken: sellTokenAddress,
            buyToken: buyTokenAddress,
            sellAmount: '1000000',
            taker: testAddress,
            swapFeeRecipient: PLATFORM_FEE_RECIPIENT,
            swapFeeBps: String(PLATFORM_FEE_BPS),
            swapFeeToken: buyTokenAddress,
            tradeSurplusRecipient: testAddress
          });
          const quoteUrl = `${baseUrl}/gasless/quote?${quoteQs}`;
          const quoteResp = await fetch(quoteUrl, { headers: { '0x-api-key': ZERO_X_API_KEY!, '0x-version': 'v2' } });
          const quoteRequestId = quoteResp.headers.get('x-request-id');
          const quoteText = await quoteResp.text();
          let quoteJson: any = null;
          try { quoteJson = JSON.parse(quoteText); } catch {}
          
          results.tests.gaslessQuote = {
            ok: quoteResp.ok,
            status: quoteResp.status,
            requestId: quoteRequestId,
            endpoint: '/gasless/quote',
            body: quoteResp.ok ? { 
              buyAmount: quoteJson?.buyAmount,
              allowanceTarget: quoteJson?.allowanceTarget,
              hasApproval: !!quoteJson?.approval,
              hasTrade: !!quoteJson?.trade
            } : { error: quoteJson?.message || quoteText?.slice(0, 200) }
          };
        } catch (e: any) {
          results.tests.gaslessQuote = { ok: false, error: e.message };
        }
        
        return new Response(JSON.stringify({
          success: true,
          self_test: results
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } catch (e: any) {
        return new Response(JSON.stringify({
          success: false,
          error: 'self_test_failed',
          message: e?.message || 'Failed to run self-test',
          results
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    if (operation === 'get_price') {
      const { sellToken, buyToken, sellAmount, chainId } = params;
      
      // Validate chain is supported
      const availableChains = Object.keys(TOKEN_ADDRESSES).map(Number);
      if (!availableChains.includes(chainId)) {
        console.error('Unsupported chain:', { chainId, availableChains });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'unsupported_chain',
            message: `Chain ${chainId} is not supported. Available: ${availableChains.join(', ')}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Strip _ARB suffix if present (for Arbitrum tokens)
      const cleanSellToken = sellToken.replace('_ARB', '');
      const cleanBuyToken = buyToken.replace('_ARB', '');
      
      // Special case: XAUT is not supported on Arbitrum (no liquidity)
      if (chainId === 42161 && (cleanSellToken === 'XAUT' || cleanBuyToken === 'XAUT')) {
        console.warn('⚠️ XAUT swap requested on Arbitrum - not supported');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'no_route',
            message: 'XAUT is not supported on Arbitrum (no liquidity). Please switch to Ethereum to trade XAUT.',
            chainId,
            sellToken,
            buyToken
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
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
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'token_not_found',
            message: `Token not supported on chain ${chainId}: ${cleanSellToken} or ${cleanBuyToken}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const queryParams = new URLSearchParams({
        chainId: chainId.toString(), // ✅ Required by permit2 API
        sellToken: sellTokenAddress,
        buyToken: buyTokenAddress,
        sellAmount: sellAmount,
        slippagePercentage: '0.005',
        swapFeeRecipient: PLATFORM_FEE_RECIPIENT, // v2 parameter - EOA wallet
        swapFeeBps: String(PLATFORM_FEE_BPS), // v2 parameter (0.8%)
        swapFeeToken: buyTokenAddress // v2 parameter - fee collected in output token
      });

      const baseUrl = getZeroXSwapBaseUrl(chainId);
      
      // Phase 1B: Try multiple sources for Arbitrum
      if (chainId === 42161) {
        const sources = ['Algebra', 'Camelot', 'CamelotV3', 'Camelot_V3'];
        const testedSources: string[] = [];
        let lastError: any = null;
        
        for (const source of sources) {
          const testParams = new URLSearchParams(queryParams);
          testParams.append('includedSources', source);
          const priceUrl = `${baseUrl}/swap/permit2/price?${testParams}`;
          
          console.log(`🧪 Phase 1B: Testing source "${source}" for Arbitrum`, {
            fullUrl: priceUrl,
            sellToken: `${sellToken} -> ${sellTokenAddress}`,
            buyToken: `${buyToken} -> ${buyTokenAddress}`
          });
          
          try {
            const response = await fetch(priceUrl, {
              headers: {
                '0x-api-key': ZERO_X_API_KEY,
                '0x-version': 'v2' // Required for v2 API
              }
            });
            
            if (response.ok) {
              console.log(`✅ 0x source "${source}" worked for Arbitrum!`);
              const data = await response.json();
              return new Response(JSON.stringify({ 
                success: true,
                price: data,
                routeSource: source
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            testedSources.push(source);
            const errorBody = await response.text();
            const requestId = response.headers.get('x-request-id');
            lastError = { status: response.status, body: errorBody, requestId, source };
            
            console.log(`❌ 0x source "${source}" failed:`, {
              status: response.status,
              requestId,
              body: errorBody.substring(0, 200)
            });
          } catch (err) {
            testedSources.push(source);
            console.error(`❌ 0x source "${source}" request failed:`, err);
          }
        }
        
        // All sources failed - return normalized 200 error
        console.error('❌ All 0x sources failed for Arbitrum', { testedSources });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'no_route',
            message: `No liquidity for ${sellToken} → ${buyToken} swap on Arbitrum. Try a different pair or switch to Ethereum.`,
            chainId,
            sellToken,
            buyToken,
            testedSources,
            requestId: lastError?.requestId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Standard flow for non-Arbitrum - use Gasless v2 price endpoint
      const priceUrl = `${baseUrl}/gasless/price?${queryParams}`;
      
      console.log('🔍 0x v2 Gasless Price Request:', {
        chainId,
        baseUrl,
        endpoint: '/gasless/price',
        fullUrl: priceUrl,
        sellToken: `${sellToken} -> ${sellTokenAddress}`,
        buyToken: `${buyToken} -> ${buyTokenAddress}`,
        sellAmount,
        headers: {
          '0x-api-key': ZERO_X_API_KEY ? '✅ Present' : '❌ Missing',
          '0x-version': 'v2'
        }
      });

      const response = await fetch(priceUrl, {
        headers: {
          '0x-api-key': ZERO_X_API_KEY,
          '0x-version': 'v2' // Required for v2 API
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        const requestId = response.headers.get('x-request-id');
        
        // Enhanced error logging
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { raw: errorText };
        }
        
        console.error('❌ 0x v2 price API error:', {
          status: response.status,
          statusText: response.statusText,
          requestUrl: priceUrl,
          requestId,
          headers: {
            'content-type': response.headers.get('content-type'),
            'x-0x-version': response.headers.get('x-0x-version')
          },
          errorDetails,
          requestParams: {
            chainId,
            sellToken: sellTokenAddress,
            buyToken: buyTokenAddress,
            sellAmount
          }
        });
        
        // Normalize error response to 200 with details
        const errorMsg = errorDetails.message || errorDetails.reason || errorText;
        let userMessage = errorMsg;
        
        if (errorMsg.includes('no Route matched') || response.status === 404) {
          userMessage = `No liquidity for ${sellToken} → ${buyToken} swap. Try a different pair or amount.`;
        } else if (response.status === 401 || response.status === 403) {
          userMessage = 'API authentication failed. Please contact support.';
        } else if (response.status === 429) {
          userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        }
        
        return new Response(
          JSON.stringify({
            success: false,
            error: response.status === 404 ? 'no_route' : 'api_error',
            message: userMessage,
            status: response.status,
            requestId,
            chainId,
            sellToken,
            buyToken
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const price = await response.json();
      console.log('✅ Indicative price received:', { 
        buyAmount: price.buyAmount, 
        price: price.price,
        allowanceTarget: price.allowanceTarget // May be present in price response
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          price: {
            ...price,
            allowanceTarget: price.allowanceTarget // Pass through if present
          }
        }),
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
        swapFeeRecipient: PLATFORM_FEE_RECIPIENT, // EOA wallet
        swapFeeBps: String(PLATFORM_FEE_BPS), // 0.8% platform fee
        swapFeeToken: buyTokenAddress,
        tradeSurplusRecipient: userAddress
      });

      const baseUrl = getZeroXSwapBaseUrl(chainId);
      
      // Phase 1B: Try multiple sources for Arbitrum
      if (chainId === 42161) {
        const sources = ['Algebra', 'Camelot', 'CamelotV3', 'Camelot_V3'];
        const testedSources: string[] = [];
        let lastError: any = null;
        
        for (const source of sources) {
          const testParams = new URLSearchParams(queryParams);
          testParams.append('includedSources', source);
          const quoteUrl = `${baseUrl}/gasless/quote?${testParams}`;
          
          console.log(`🧪 Phase 1B: Testing source "${source}" for Arbitrum gasless quote`, {
            fullUrl: quoteUrl,
            sellToken: `${sellToken} -> ${sellTokenAddress}`,
            buyToken: `${buyToken} -> ${buyTokenAddress}`,
            taker: userAddress
          });
          
          try {
            const response = await fetch(quoteUrl, {
              headers: {
                '0x-api-key': ZERO_X_API_KEY,
                '0x-version': 'v2'
              }
            });
            
            if (response.ok) {
              console.log(`✅ 0x gasless source "${source}" worked for Arbitrum!`);
              const data = await response.json();
              return new Response(JSON.stringify({ 
                success: true,
                quote: {
                  ...data,
                  chainId: chainId // ✅ Inject chainId for Arbitrum quotes
                },
                routeSource: source
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            testedSources.push(source);
            const errorBody = await response.text();
            const requestId = response.headers.get('x-request-id');
            lastError = { status: response.status, body: errorBody, requestId, source };
            
            console.log(`❌ 0x gasless source "${source}" failed:`, {
              status: response.status,
              requestId,
              body: errorBody.substring(0, 200)
            });
          } catch (err) {
            testedSources.push(source);
            console.error(`❌ 0x gasless source "${source}" request failed:`, err);
          }
        }
        
        // All sources failed - return normalized 200 error for fallback
        console.error('❌ All 0x gasless sources failed for Arbitrum - will fallback to Camelot V3', { testedSources });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'no_route',
            message: `No liquidity for ${sellToken} → ${buyToken} gasless swap on Arbitrum. Try a different pair or switch to Ethereum.`,
            chainId,
            sellToken,
            buyToken,
            testedSources,
            requestId: lastError?.requestId,
            fallbackToCamelot: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Standard flow for non-Arbitrum
      const quoteUrl = `${baseUrl}/gasless/quote?${queryParams}`;
      
      console.log('🔍 0x v2 Gasless Quote Request:', {
        chainId,
        baseUrl,
        endpoint: '/gasless/quote',
        fullUrl: quoteUrl,
        sellToken: `${sellToken} -> ${sellTokenAddress}`,
        buyToken: `${buyToken} -> ${buyTokenAddress}`,
        sellAmount,
        userAddress,
        swapFeeToken: buyTokenAddress,
        headers: {
          '0x-api-key': ZERO_X_API_KEY ? '✅ Present' : '❌ Missing',
          '0x-version': 'v2'
        }
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
        
        // Enhanced error logging
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { raw: errorText };
        }
        
        console.error('❌ 0x v2 gasless quote API error:', {
          status: response.status,
          statusText: response.statusText,
          requestUrl: quoteUrl,
          requestId,
          headers: {
            'content-type': response.headers.get('content-type'),
            'x-0x-version': response.headers.get('x-0x-version')
          },
          errorDetails,
          requestParams: {
            chainId,
            sellToken: sellTokenAddress,
            buyToken: buyTokenAddress,
            swapFeeToken: buyTokenAddress,
            taker: userAddress
          }
        });
        
        // Normalize error response to 200 with details
        const errorMsg = errorDetails.message || errorDetails.reason || errorText;
        let userMessage = errorMsg;
        
        if (errorMsg.includes('no Route matched') || response.status === 404) {
          userMessage = `No liquidity for ${sellToken} → ${buyToken} gasless swap. Try a different pair or amount.`;
        } else if (response.status === 401 || response.status === 403) {
          userMessage = 'API authentication failed. Please contact support.';
        } else if (response.status === 429) {
          userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        }
        
        return new Response(
          JSON.stringify({
            success: false,
            error: response.status === 404 ? 'no_route' : 'api_error',
            message: userMessage,
            status: response.status,
            requestId,
            chainId,
            sellToken,
            buyToken
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const quote = await response.json();
      console.log('✅ 0x v2 Gasless Quote Response:', {
        buyAmount: quote.buyAmount,
        chainId: quote.chainId, // Will be undefined from 0x API
        allowanceTarget: quote.allowanceTarget,
        hasApproval: !!quote.approval,
        hasTrade: !!quote.trade,
        hasIssues: !!quote.issues?.allowance || !!quote.issues?.balance
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          quote: {
            ...quote,
            chainId: chainId, // ✅ Inject chainId from request params
            allowanceTarget: quote.allowanceTarget
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'submit_swap') {
      const { quote, signatures, quoteId, intentId } = params;

      console.log('Submitting gasless swap to 0x', {
        chainId: quote.chainId,
        hasApproval: !!quote.approval,
        hasTrade: !!quote.trade
      });

      // Validate required fields
      if (!quote.chainId) {
        throw new Error('Missing chainId in quote');
      }
      if (!quote.trade) {
        throw new Error('Missing trade data in quote');
      }
      if (!signatures || !signatures.trade) {
        throw new Error('Missing trade signature');
      }

      // Helper to convert 0x hex signature to { r, s, v }
      const toSigObject = (sig: string) => {
        const hex = sig.startsWith('0x') ? sig.slice(2) : sig;
        if (hex.length !== 130) throw new Error('Unexpected signature length');
        const r = '0x' + hex.slice(0, 64);
        const s = '0x' + hex.slice(64, 128);
        let v = parseInt(hex.slice(128, 130), 16);
        if (v === 0 || v === 1) v += 27;
        return { r, s, v };
      };

      // ✅ Pre-check deadlines for staleness
      const now = Math.floor(Date.now() / 1000);
      const tradeDeadline = quote.trade?.eip712?.message?.deadline;
      const approvalDeadline = quote.approval?.eip712?.message?.deadline;
      
      if (tradeDeadline && now > Number(tradeDeadline) - 10) {
        console.warn('⏱️ Trade deadline is stale or near expiry:', {
          now,
          deadline: tradeDeadline,
          secondsRemaining: Number(tradeDeadline) - now
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'quote_expired',
            message: 'Quote deadline has passed. Please refresh and try again.',
            code: 400
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (approvalDeadline && now > Number(approvalDeadline) - 10) {
        console.warn('⏱️ Approval deadline is stale or near expiry');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'quote_expired',
            message: 'Approval deadline has passed. Please refresh and try again.',
            code: 400
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ✅ Construct proper payload per 0x API docs with signatureType
      const submitPayload: any = {
        chainId: Number(quote.chainId),
        trade: {
          type: quote.trade.type,
          eip712: quote.trade.eip712,
          signature: {
            ...toSigObject(signatures.trade),
            signatureType: 2 // EIP-712 typed data signature
          }
        }
      };

      // Include approval if present
      if (quote.approval && signatures.approval) {
        submitPayload.approval = {
          type: quote.approval.type,
          eip712: quote.approval.eip712,
          signature: {
            ...toSigObject(signatures.approval),
            signatureType: 2 // EIP-712 typed data signature
          }
        };
      }

      console.log('📤 Submit payload:', {
        chainId: submitPayload.chainId,
        hasApproval: !!submitPayload.approval,
        hasTrade: !!submitPayload.trade,
        tradeType: quote.trade.type
      });

      // ✅ Retry logic for transient errors
      let lastError: any;
      const maxRetries = 2;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const backoff = attempt === 1 ? 300 : 800;
            console.log(`⏳ Retry attempt ${attempt} after ${backoff}ms`);
            await new Promise(resolve => setTimeout(resolve, backoff));
          }

          const submitUrl = `https://api.0x.org/gasless/submit?chainId=${submitPayload.chainId}`;
          const response = await fetch(submitUrl, {
            method: 'POST',
            headers: {
              '0x-api-key': ZERO_X_API_KEY,
              '0x-version': 'v2',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(submitPayload)
          });

          const requestId = response.headers.get('x-request-id');
          const zid = response.headers.get('zid');

          if (!response.ok) {
            const errorText = await response.text();
            
            // Retry on 5xx errors
            if (response.status >= 500 && attempt < maxRetries) {
              console.warn(`⚠️ 0x API ${response.status} error, will retry:`, { requestId, zid });
              lastError = { status: response.status, text: errorText, requestId, zid };
              continue;
            }
            
            // Parse 4xx errors
            let parsedError: any = {};
            try {
              parsedError = JSON.parse(errorText);
            } catch {}
            
            const errorMessage = parsedError.message || parsedError.name || errorText;
            const errorDetails = parsedError.data?.details;
            
            console.error('❌ 0x submit error:', {
              status: response.status,
              requestId,
              zid,
              error: errorText,
              parsedError
            });
            
            // Check for stale/invalid signature errors
            const isStale = errorMessage.toLowerCase().includes('expired') ||
                          errorMessage.toLowerCase().includes('stale') ||
                          errorMessage.toLowerCase().includes('invalid nonce') ||
                          errorMessage.toLowerCase().includes('invalid signature');
            
            return new Response(
              JSON.stringify({
                success: false,
                error: isStale ? 'stale_or_invalid_signature' : 'submit_failed',
                message: errorMessage,
                details: errorDetails,
                requestId,
                zid,
                code: response.status,
                hint: isStale ? 'requote_and_resign' : undefined
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const result = await response.json();
          console.log('✅ Swap submitted successfully:', { 
            tradeHash: result.tradeHash,
            status: result.status,
            requestId,
            zid
          });

          return new Response(
            JSON.stringify({ success: true, result, requestId, zid }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (err: any) {
          lastError = err;
          if (attempt === maxRetries) break;
          console.warn(`⚠️ Request failed, attempt ${attempt + 1}:`, err.message);
        }
      }

      // All retries exhausted
      console.error('❌ All retry attempts failed:', lastError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'api_error',
          message: lastError?.text || lastError?.message || 'Failed to submit after retries',
          requestId: lastError?.requestId,
          zid: lastError?.zid,
          code: lastError?.status || 500
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'get_status') {
      const { tradeHash, chainId } = params;
      const statusChainId = chainId || 1; // Default to Ethereum mainnet

      const statusUrl = `https://api.0x.org/gasless/status/${tradeHash}?chainId=${statusChainId}`;
      const response = await fetch(statusUrl, {
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
        error: 'edge_error',
        message: error.message 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
