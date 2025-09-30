import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MoonPayProxyRequest {
  amount: number;
  currency: string;
  walletAddress: string;
  userId: string;
  returnUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const body: MoonPayProxyRequest = await req.json();
    const { amount, currency, walletAddress, userId, returnUrl } = body;

    console.log('MoonPay proxy request:', { amount, currency, userId });

    // Validate input
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (amount < 10) {
      throw new Error('Minimum purchase amount is $10');
    }

    if (amount > 10000) {
      throw new Error('Maximum purchase amount is $10,000');
    }

    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      throw new Error('Invalid currency');
    }

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    // Check transaction velocity
    const { data: velocityCheck, error: velocityError } = await supabase.rpc(
      'check_transaction_velocity',
      {
        p_user_id: userId,
        p_amount: amount,
      }
    );

    if (velocityError) {
      console.error('Velocity check error:', velocityError);
      throw new Error('Failed to validate transaction limits');
    }

    if (!velocityCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: velocityCheck.reason,
          details: velocityCheck,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get MoonPay publishable key from secrets
    const moonPayPublishableKey = Deno.env.get('MOONPAY_PUBLISHABLE_KEY');
    if (!moonPayPublishableKey) {
      throw new Error('MoonPay API key not configured');
    }

    // Build MoonPay widget URL with secure parameters
    const baseUrl = 'https://buy-sandbox.moonpay.com';
    const params = new URLSearchParams({
      apiKey: moonPayPublishableKey,
      baseCurrencyCode: currency.toLowerCase(),
      baseCurrencyAmount: amount.toString(),
      defaultCurrencyCode: 'usdc',
      walletAddress: walletAddress,
      externalCustomerId: userId,
      theme: 'dark',
      redirectURL: returnUrl || `${Deno.env.get('SITE_URL')}/moonpay-callback`,
    });

    const widgetUrl = `${baseUrl}?${params.toString()}`;

    // Store transaction record
    const { error: insertError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        currency: currency,
        provider: 'moonpay',
        status: 'pending',
        external_id: `moonpay_${Date.now()}`,
        metadata: {
          wallet_address: walletAddress,
          widget_url: widgetUrl,
          requires_confirmation: velocityCheck.requires_confirmation,
        },
      });

    if (insertError) {
      console.error('Failed to store transaction:', insertError);
      // Don't fail the request, just log the error
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      event_type: 'moonpay_transaction_initiated',
      event_data: {
        user_id: userId,
        amount: amount,
        currency: currency,
        requires_confirmation: velocityCheck.requires_confirmation,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        widgetUrl: widgetUrl,
        requiresConfirmation: velocityCheck.requires_confirmation,
        limits: velocityCheck.limits,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('MoonPay proxy error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: error.message?.includes('Unauthorized') ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
