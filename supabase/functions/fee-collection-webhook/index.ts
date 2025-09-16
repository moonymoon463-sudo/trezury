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

interface WebhookPayload {
  requestId: string;
  externalTxHash: string;
  status: 'completed' | 'failed';
  signature?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fee collection webhook called');
    
    const payload: WebhookPayload = await req.json();
    console.log('Webhook payload received:', payload);

    // Verify the request signature (basic validation)
    const webhookSecret = Deno.env.get('FEE_COLLECTION_WEBHOOK_SECRET');
    if (webhookSecret && payload.signature) {
      // In production, implement proper HMAC-SHA256 signature verification
      console.log('Webhook signature verification would happen here');
    }

    // Validate required fields
    if (!payload.requestId || !payload.status) {
      console.error('Missing required fields in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing requestId or status' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the fee collection request status
    const { data: request, error: fetchError } = await supabase
      .from('fee_collection_requests')
      .select('*')
      .eq('id', payload.requestId)
      .single();

    if (fetchError || !request) {
      console.error('Fee collection request not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Fee collection request not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the request with external transaction details
    const updateData: any = {
      status: payload.status,
      webhook_data: payload.metadata || {},
    };

    if (payload.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.external_tx_hash = payload.externalTxHash;
    }

    const { error: updateError } = await supabase
      .from('fee_collection_requests')
      .update(updateData)
      .eq('id', payload.requestId);

    if (updateError) {
      console.error('Error updating fee collection request:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update request' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If completed, mark the original transaction as fee collected
    if (payload.status === 'completed') {
      const { error: txUpdateError } = await supabase
        .from('transactions')
        .update({
          metadata: {
            ...request.metadata,
            platform_fee_collected: true,
            platform_fee_tx_hash: payload.externalTxHash,
            platform_fee_collected_at: new Date().toISOString()
          }
        })
        .eq('id', request.transaction_id);

      if (txUpdateError) {
        console.error('Error updating transaction metadata:', txUpdateError);
      }

      // Create a notification for the user
      await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          title: 'Platform Fee Collected',
          body: `Platform fee of ${request.amount} ${request.asset} has been collected`,
          kind: 'fee_collection'
        });

      console.log(`Fee collection completed for request ${payload.requestId}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Fee collection request ${payload.status}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fee collection webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});