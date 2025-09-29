import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, getClientIp, getRateLimitHeaders, createRateLimitResponse } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// API Key rate limit tracking (in-memory for this endpoint)
const apiKeyLimits = new Map<string, { count: number; resetAt: number }>();

function checkApiKeyRateLimit(apiKey: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const limit = apiKeyLimits.get(apiKey);
  
  if (!limit || now > limit.resetAt) {
    apiKeyLimits.set(apiKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count < maxRequests) {
    limit.count++;
    return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // IP-based rate limiting (50 requests per minute)
    const clientIp = getClientIp(req);
    const ipRateLimit = await checkRateLimit(
      supabaseUrl,
      supabaseKey,
      clientIp,
      'fee-collection-api',
      50,
      60000
    );

    if (!ipRateLimit.allowed) {
      return createRateLimitResponse(ipRateLimit, corsHeaders);
    }

    // API Key authentication
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('FEE_COLLECTION_API_KEY');
    
    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid API key' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, ...getRateLimitHeaders(ipRateLimit), 'Content-Type': 'application/json' } 
        }
      );
    }

    // API Key rate limiting (500 requests per hour)
    const apiKeyAllowed = checkApiKeyRateLimit(apiKey, 500, 3600000);
    if (!apiKeyAllowed) {
      console.warn(`API key rate limit exceeded: ${apiKey.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ 
          error: 'API key rate limit exceeded',
          retryAfter: 3600 
        }), 
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            ...getRateLimitHeaders(ipRateLimit),
            'Content-Type': 'application/json',
            'Retry-After': '3600'
          } 
        }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname;

    // GET /pending-requests - Fetch all pending fee collection requests
    if (path.endsWith('/pending-requests') && req.method === 'GET') {
      const { data, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ requests: data }), 
        { headers: { ...corsHeaders, ...getRateLimitHeaders(ipRateLimit), 'Content-Type': 'application/json' } }
      );
    }

    // GET /request/{id} - Fetch specific request
    if (path.includes('/request/') && req.method === 'GET') {
      const requestId = path.split('/request/')[1];
      
      const { data, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ request: data }), 
        { headers: { ...corsHeaders, ...getRateLimitHeaders(ipRateLimit), 'Content-Type': 'application/json' } }
      );
    }

    // POST /mark-completed - Mark a request as completed
    if (path.endsWith('/mark-completed') && req.method === 'POST') {
      const { requestId, txHash } = await req.json();

      if (!requestId || !txHash) {
        return new Response(
          JSON.stringify({ error: 'Missing requestId or txHash' }), 
          { status: 400, headers: { ...corsHeaders, ...getRateLimitHeaders(ipRateLimit), 'Content-Type': 'application/json' } }
        );
      }

      // Get the request details
      const { data: request, error: fetchError } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return new Response(
          JSON.stringify({ error: 'Fee collection request not found' }), 
          { status: 404, headers: { ...corsHeaders, ...getRateLimitHeaders(ipRateLimit), 'Content-Type': 'application/json' } }
        );
      }

      // Update the request status
      const { error: updateError } = await supabase
        .from('fee_collection_requests')
        .update({
          status: 'completed',
          external_tx_hash: txHash,
          completed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) {
        throw updateError;
      }

      // Update the original transaction metadata
      const { error: txUpdateError } = await supabase
        .from('transactions')
        .update({
          metadata: {
            ...request.metadata,
            platform_fee_collected: true,
            platform_fee_tx_hash: txHash,
            platform_fee_collected_at: new Date().toISOString()
          }
        })
        .eq('id', request.transaction_id);

      if (txUpdateError) {
        console.error('Error updating transaction metadata:', txUpdateError);
      }

      // Log security event
      await supabase.rpc('log_security_event', {
        event_type: 'fee_collection_completed',
        event_data: {
          request_id: requestId,
          tx_hash: txHash,
          amount: request.amount,
          asset: request.asset
        }
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Fee collection request marked as completed' 
        }), 
        { headers: { ...corsHeaders, ...getRateLimitHeaders(ipRateLimit), 'Content-Type': 'application/json' } }
      );
    }

    // GET /export/gnosis-safe - Export pending requests as Gnosis Safe CSV
    if (path.endsWith('/export/gnosis-safe') && req.method === 'GET') {
      const { data: requests, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Format for Gnosis Safe transaction batch
      const gnosisBatch = requests?.map(req => ({
        to: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835', // Platform wallet
        value: '0',
        data: '', // Would need contract interaction data
        contractMethod: {
          name: 'transfer',
          inputs: [
            { name: 'to', type: 'address', value: req.to_address },
            { name: 'amount', type: 'uint256', value: req.amount }
          ]
        }
      }));

      return new Response(
        JSON.stringify({ 
          transactions: gnosisBatch,
          total_amount: requests?.reduce((sum, r) => sum + Number(r.amount), 0) || 0
        }), 
        { headers: { ...corsHeaders, ...getRateLimitHeaders(ipRateLimit), 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }), 
      { status: 404, headers: { ...corsHeaders, ...getRateLimitHeaders(ipRateLimit), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fee-collection-api:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});