import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simple in-memory rate limiting for API key
const apiKeyLimits = new Map<string, { count: number; resetAt: number }>();

function checkApiKeyRateLimit(apiKey: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const limit = apiKeyLimits.get(apiKey);
  
  if (!limit || now > limit.resetAt) {
    apiKeyLimits.set(apiKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { checkRateLimit } = await import('../_shared/rateLimiter.ts');
    const rateLimitCheck = await checkRateLimit(clientIp, 10, 60000);
    
    if (!rateLimitCheck.allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Authenticate request (require API key for production use)
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('FEE_COLLECTION_API_KEY') || 'dev-test-key-12345';
    
    if (apiKey !== expectedApiKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Additional API key rate limiting
    if (!checkApiKeyRateLimit(apiKey, 20, 60000)) {
      return new Response(JSON.stringify({ error: 'API key rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    // GET /pending-requests - Fetch all pending fee collection requests
    if (pathname.includes('/pending-requests') && req.method === 'GET') {
      const { data, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /request/:id - Fetch specific request
    if (pathname.includes('/request/') && req.method === 'GET') {
      const id = pathname.split('/').pop();
      
      const { data, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /mark-completed - Mark fee collection request as completed
    if (pathname.includes('/mark-completed') && req.method === 'POST') {
      const { requestId, txHash } = await req.json();

      if (!requestId || !txHash) {
        return new Response(JSON.stringify({ error: 'Missing requestId or txHash' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('fee_collection_requests')
        .update({
          status: 'completed',
          external_tx_hash: txHash,
          completed_at: new Date().toISOString(),
          metadata: {
            completed_via: 'api',
            completed_at: new Date().toISOString()
          }
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log security event
      await supabase.from('audit_log').insert({
        user_id: data.user_id,
        table_name: 'fee_collection_requests',
        operation: 'FEE_COLLECTED',
        metadata: {
          request_id: requestId,
          tx_hash: txHash,
          amount: data.amount,
          asset: data.asset
        }
      });

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /export/gnosis-safe - Export pending requests in Gnosis Safe batch format
    if (pathname.includes('/export/gnosis-safe') && req.method === 'GET') {
      const { data: requests, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('status', 'pending')
        .order('asset', { ascending: true });

      if (error) {
        throw error;
      }

      // Group by asset and aggregate amounts
      const assetTotals = requests.reduce((acc, req) => {
        if (!acc[req.asset]) {
          acc[req.asset] = {
            asset: req.asset,
            from_address: req.from_address,
            to_address: req.to_address,
            total_amount: 0,
            request_ids: []
          };
        }
        acc[req.asset].total_amount += parseFloat(req.amount);
        acc[req.asset].request_ids.push(req.id);
        return acc;
      }, {} as Record<string, any>);

      // Convert to Gnosis Safe batch transaction format
      const batchTransactions = Object.values(assetTotals).map((item: any) => ({
        to: item.to_address,
        value: '0', // ERC-20 transfers have 0 ETH value
        data: `0xa9059cbb${item.to_address.slice(2).padStart(64, '0')}${Math.floor(item.total_amount * 1e6).toString(16).padStart(64, '0')}`, // ERC-20 transfer(address,uint256)
        contractMethod: {
          name: 'transfer',
          payable: false
        },
        contractInputsValues: {
          _to: item.to_address,
          _value: (item.total_amount * 1e6).toString()
        }
      }));

      return new Response(JSON.stringify({
        success: true,
        version: '1.0',
        chainId: '1',
        meta: {
          name: 'Fee Collection Batch',
          description: `Collect ${Object.keys(assetTotals).length} asset fees`,
          created_at: new Date().toISOString()
        },
        transactions: batchTransactions,
        request_details: assetTotals
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Fee collection API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
