import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(req: Request): string {
  // Check various headers for IP address
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  return 'unknown';
}

/**
 * Check rate limit for a given identifier and endpoint
 * Uses sliding window algorithm with database persistence
 * 
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase service role key (for database access)
 * @param identifier - Unique identifier (IP address or user ID)
 * @param endpoint - Endpoint name
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result with allowed status and metadata
 */
export async function checkRateLimit(
  supabaseUrl: string,
  supabaseKey: string,
  identifier: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  try {
    // Get existing rate limit record
    const { data: record, error: fetchError } = await supabase
      .from('api_rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (fetchError) {
      console.error('Rate limit fetch error:', fetchError);
      // On error, allow request but log
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now.getTime() + windowMs),
        limit: maxRequests
      };
    }

    // Check if blocked
    if (record?.blocked_until && new Date(record.blocked_until) > now) {
      console.log(`Identifier ${identifier} blocked until ${record.blocked_until}`);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(record.blocked_until),
        limit: maxRequests
      };
    }

    // Reset window if expired or no record exists
    if (!record || new Date(record.window_start) < windowStart) {
      const { error: upsertError } = await supabase
        .from('api_rate_limits')
        .upsert({
          identifier,
          endpoint,
          request_count: 1,
          window_start: now.toISOString(),
          last_request: now.toISOString(),
          blocked_until: null
        }, {
          onConflict: 'identifier,endpoint'
        });

      if (upsertError) {
        console.error('Rate limit upsert error:', upsertError);
      }

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now.getTime() + windowMs),
        limit: maxRequests
      };
    }

    // Check if limit exceeded
    if (record.request_count >= maxRequests) {
      // Block for 5 minutes on repeated violations
      const blockUntil = new Date(now.getTime() + 300000); // 5 minutes
      
      await supabase
        .from('api_rate_limits')
        .update({
          blocked_until: blockUntil.toISOString()
        })
        .eq('identifier', identifier)
        .eq('endpoint', endpoint);

      console.log(`Rate limit exceeded for ${identifier} on ${endpoint}. Blocked until ${blockUntil}`);

      return {
        allowed: false,
        remaining: 0,
        resetAt: blockUntil,
        limit: maxRequests
      };
    }

    // Increment counter
    const { error: updateError } = await supabase
      .from('api_rate_limits')
      .update({
        request_count: record.request_count + 1,
        last_request: now.toISOString()
      })
      .eq('identifier', identifier)
      .eq('endpoint', endpoint);

    if (updateError) {
      console.error('Rate limit update error:', updateError);
    }

    const resetAt = new Date(new Date(record.window_start).getTime() + windowMs);

    return {
      allowed: true,
      remaining: maxRequests - record.request_count - 1,
      resetAt,
      limit: maxRequests
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(now.getTime() + windowMs),
      limit: maxRequests
    };
  }
}

/**
 * Generate rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
  };
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again after ${result.resetAt.toISOString()}`,
      retryAfter: result.resetAt.toISOString()
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...getRateLimitHeaders(result),
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString()
      }
    }
  );
}
