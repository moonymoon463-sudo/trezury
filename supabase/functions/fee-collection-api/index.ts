import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // API key authentication
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('FEE_COLLECTION_API_KEY');
    
    if (expectedApiKey && apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fee collection API called: ${req.method} ${path}`);

    // GET /pending-requests - Return pending fee collection requests
    if (req.method === 'GET' && path.endsWith('/pending-requests')) {
      const { data: requests, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching pending requests:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch requests' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          requests: requests || [],
          count: requests?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /request/{id} - Get specific fee collection request details
    if (req.method === 'GET' && path.includes('/request/')) {
      const requestId = path.split('/request/')[1];
      
      const { data: request, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error || !request) {
        return new Response(
          JSON.stringify({ error: 'Request not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, request }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /mark-completed - Mark a fee collection as completed
    if (req.method === 'POST' && path.endsWith('/mark-completed')) {
      const { requestId, externalTxHash, metadata } = await req.json();
      
      if (!requestId) {
        return new Response(
          JSON.stringify({ error: 'Missing requestId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: request, error: fetchError } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return new Response(
          JSON.stringify({ error: 'Request not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update the request as completed
      const { error: updateError } = await supabase
        .from('fee_collection_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          external_tx_hash: externalTxHash,
          webhook_data: metadata || {}
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error updating fee collection request:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark the original transaction as fee collected
      await supabase
        .from('transactions')
        .update({
          metadata: {
            ...request.metadata,
            platform_fee_collected: true,
            platform_fee_tx_hash: externalTxHash,
            platform_fee_collected_at: new Date().toISOString()
          }
        })
        .eq('id', request.transaction_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Fee collection marked as completed' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /export/gnosis-safe - Export pending fees as Gnosis Safe transaction batch
    if (req.method === 'GET' && path.endsWith('/export/gnosis-safe')) {
      const { data: requests, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch requests' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Group by asset for batching
      const batchesByAsset = requests?.reduce((acc: any, request) => {
        if (!acc[request.asset]) {
          acc[request.asset] = [];
        }
        acc[request.asset].push(request);
        return acc;
      }, {}) || {};

      const gnosisBatch = Object.entries(batchesByAsset).map(([asset, requests]) => ({
        to: "0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835", // Platform wallet
        value: "0",
        data: null,
        contractMethod: {
          inputs: [],
          name: "transfer",
          payable: false
        },
        contractInputsValues: {
          _to: "0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835",
          _value: (requests as any[]).reduce((sum: number, req: any) => sum + parseFloat(req.amount.toString()), 0).toString()
        }
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          gnosisBatch,
          totalRequests: requests?.length || 0,
          metadata: {
            generatedAt: new Date().toISOString(),
            platformWallet: "0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835"
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fee collection API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});