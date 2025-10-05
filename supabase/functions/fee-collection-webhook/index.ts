import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, getClientIp, getRateLimitHeaders, createRateLimitResponse } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface WebhookPayload {
  requestId: string;
  externalTxHash: string;
  status: 'completed' | 'failed';
  metadata?: Record<string, any>;
}

// HMAC-SHA256 signature verification
async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting: 200 requests per minute per IP
    const clientIp = getClientIp(req);
    const rateLimitResult = await checkRateLimit(
      supabaseUrl,
      supabaseKey,
      clientIp,
      'fee-collection-webhook',
      200,
      60000
    );

    if (!rateLimitResult.allowed) {
      console.warn(`Webhook rate limit exceeded for IP: ${clientIp}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    console.log('Fee collection webhook called');
    
    // Get webhook secret - REQUIRED
    const webhookSecret = Deno.env.get('FEE_COLLECTION_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('FEE_COLLECTION_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook verification not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get signature header - REQUIRED
    const signature = req.headers.get('x-signature');
    if (!signature) {
      console.warn('⚠️ Webhook missing signature header');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read body for signature verification
    const webhookBody = await req.text();
    
    // Verify HMAC-SHA256 signature
    const isValid = await verifyWebhookSignature(webhookBody, signature, webhookSecret);
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      
      // Log security alert
      await supabase.from('security_alerts').insert({
        alert_type: 'invalid_webhook_signature',
        severity: 'high',
        title: 'Fee Collection Webhook - Invalid Signature',
        description: 'Webhook request rejected due to invalid HMAC signature',
        metadata: {
          ip: getClientIp(req),
          timestamp: new Date().toISOString()
        }
      });
      
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload AFTER verification
    const payload: WebhookPayload = JSON.parse(webhookBody);
    console.log('✅ Webhook signature verified, payload:', payload);

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
      { headers: { ...corsHeaders, ...getRateLimitHeaders(rateLimitResult), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fee collection webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});