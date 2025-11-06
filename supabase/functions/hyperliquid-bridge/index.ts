/**
 * Hyperliquid Bridge Edge Function
 * Production-grade architecture with provider abstraction
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { BridgeOrchestrator } from '../_shared/bridge/BridgeOrchestrator.ts';
import { validateEnvironment, ValidationError } from '../_shared/bridge/validation.ts';
import { BridgeMonitor } from '../_shared/bridge/monitoring.ts';

const monitor = new BridgeMonitor('HyperliquidBridge');
monitor.logInfo('Function started');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment on first request
    validateEnvironment();

    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request
    const { operation, ...params } = await req.json();
    monitor.logInfo(`Operation: ${operation}`, { userId: user.id });

    // Create orchestrator
    const orchestrator = new BridgeOrchestrator();

    // Route operation
    let result;
    switch (operation) {
      case 'get_quote':
        result = await orchestrator.getQuote(params);
        break;

      case 'execute_bridge':
        result = await orchestrator.executeBridge(user.id, params, supabaseClient);
        break;

      case 'check_status':
        result = await orchestrator.checkStatus(params.bridgeId, supabaseClient);
        break;

      case 'health':
        result = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          providers: ['across', 'wormhole'],
        };
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const isValidationError = error instanceof ValidationError;
    const statusCode = isValidationError ? 400 : 500;

    monitor.logError(error as Error, {
      path: new URL(req.url).pathname,
      method: req.method,
    });

    return new Response(
      JSON.stringify({
        error: (error as Error).message,
        type: isValidationError ? 'validation_error' : 'internal_error',
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
