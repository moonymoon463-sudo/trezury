import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  checks: {
    database: { status: string; responseTime: number };
    auth: { status: string; responseTime: number };
    storage: { status: string; responseTime: number };
    edgeFunctions: { status: string; responseTime: number };
  };
  metrics: {
    activeUsers: number;
    totalTransactions: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'unknown', responseTime: 0 },
        auth: { status: 'unknown', responseTime: 0 },
        storage: { status: 'unknown', responseTime: 0 },
        edgeFunctions: { status: 'healthy', responseTime: 0 }
      },
      metrics: {
        activeUsers: 0,
        totalTransactions: 0,
        errorRate: 0,
        avgResponseTime: 0
      }
    };

    // Check database connectivity
    const dbStart = Date.now();
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      
      result.checks.database = {
        status: dbError ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - dbStart
      };
    } catch (error) {
      console.error('Database check failed:', error);
      result.checks.database = {
        status: 'unhealthy',
        responseTime: Date.now() - dbStart
      };
      result.status = 'degraded';
    }

    // Check auth service
    const authStart = Date.now();
    try {
      const { error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      result.checks.auth = {
        status: authError ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - authStart
      };
    } catch (error) {
      console.error('Auth check failed:', error);
      result.checks.auth = {
        status: 'unhealthy',
        responseTime: Date.now() - authStart
      };
      result.status = 'degraded';
    }

    // Check storage
    const storageStart = Date.now();
    try {
      const { error: storageError } = await supabase.storage.listBuckets();
      result.checks.storage = {
        status: storageError ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - storageStart
      };
    } catch (error) {
      console.error('Storage check failed:', error);
      result.checks.storage = {
        status: 'unhealthy',
        responseTime: Date.now() - storageStart
      };
    }

    // Get system metrics
    try {
      // Active users (last 5 minutes)
      const { count: activeUsersCount } = await supabase
        .from('audit_log')
        .select('user_id', { count: 'exact', head: true })
        .gt('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString());
      
      result.metrics.activeUsers = activeUsersCount || 0;

      // Total completed transactions
      const { count: txCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      
      result.metrics.totalTransactions = txCount || 0;

      // Error rate (last hour)
      const { data: recentTx } = await supabase
        .from('transactions')
        .select('status')
        .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
      
      if (recentTx && recentTx.length > 0) {
        const failedCount = recentTx.filter(tx => tx.status === 'failed').length;
        result.metrics.errorRate = (failedCount / recentTx.length) * 100;
      }

      // Average response time from performance metrics
      const { data: perfMetrics } = await supabase
        .from('performance_metrics')
        .select('metric_value')
        .eq('metric_name', 'api_response_time_ms')
        .gt('recorded_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
      
      if (perfMetrics && perfMetrics.length > 0) {
        const sum = perfMetrics.reduce((acc, m) => acc + Number(m.metric_value), 0);
        result.metrics.avgResponseTime = sum / perfMetrics.length;
      }

    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }

    // Determine overall status
    const unhealthyChecks = Object.values(result.checks).filter(c => c.status === 'unhealthy').length;
    if (unhealthyChecks >= 2) {
      result.status = 'critical';
    } else if (unhealthyChecks === 1) {
      result.status = 'degraded';
    }

    // Check for critical metrics
    if (result.metrics.errorRate > 10) {
      result.status = 'critical';
    } else if (result.metrics.errorRate > 5) {
      result.status = 'degraded';
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(JSON.stringify({
      status: 'critical',
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
