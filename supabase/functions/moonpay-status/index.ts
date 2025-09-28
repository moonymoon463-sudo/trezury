import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT token
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const token = authorization.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request parameters
    const url = new URL(req.url)
    const transactionId = url.searchParams.get('transactionId')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    console.log('Fetching MoonPay status for user:', user.id, { transactionId, limit })

    // Get user's recurring transactions
    let query = supabase
      .from('moonpay_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Filter by specific transaction if provided
    if (transactionId) {
      query = query.or(`id.eq.${transactionId},moonpay_tx_id.eq.${transactionId}`)
    }

    query = query.limit(limit)

    const { data: transactions, error: transactionError } = await query

    if (transactionError) {
      console.error('Error fetching transactions:', transactionError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get customer information
    const { data: customer, error: customerError } = await supabase
      .from('moonpay_customers')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (customerError && customerError.code !== 'PGRST116') { // Ignore "not found" errors
      console.error('Error fetching customer:', customerError)
    }

    // Calculate summary statistics
    const totalTransactions = transactions?.length || 0
    const completedTransactions = transactions?.filter(t => t.status === 'completed').length || 0
    const pendingTransactions = transactions?.filter(t => t.status === 'pending').length || 0
    const failedTransactions = transactions?.filter(t => t.status === 'failed').length || 0

    const totalSpent = transactions
      ?.filter(t => t.status === 'completed' && t.amount_fiat)
      .reduce((sum, t) => sum + (t.amount_fiat || 0), 0) || 0

    const response = {
      success: true,
      user_id: user.id,
      customer: customer || null,
      transactions: transactions || [],
      summary: {
        total_transactions: totalTransactions,
        completed_transactions: completedTransactions,
        pending_transactions: pendingTransactions,
        failed_transactions: failedTransactions,
        total_spent_fiat: totalSpent,
        success_rate: totalTransactions > 0 ? (completedTransactions / totalTransactions) * 100 : 0
      },
      timestamp: new Date().toISOString()
    }

    console.log('MoonPay status response:', {
      user_id: user.id,
      transaction_count: totalTransactions,
      has_customer: !!customer
    })

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('MoonPay status error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})