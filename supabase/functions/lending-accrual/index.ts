import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

interface Lock {
  id: string;
  user_id: string;
  chain: string;
  token: string;
  amount_dec: number;
  apy_applied: number;
  start_ts: string;
  end_ts: string;
  status: string;
  accrued_interest_dec: number;
  platform_fee_rate: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting daily interest accrual job...');

    // Get all active locks
    const { data: activeLocks, error: fetchError } = await supabase
      .from('locks')
      .select('*')
      .eq('status', 'active');

    if (fetchError) {
      console.error('Error fetching active locks:', fetchError);
      throw fetchError;
    }

    if (!activeLocks || activeLocks.length === 0) {
      console.log('No active locks found');
      return new Response(
        JSON.stringify({ message: 'No active locks to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${activeLocks.length} active locks`);
    
    const updatedLocks: string[] = [];
    const now = new Date();

    for (const lock of activeLocks as Lock[]) {
      try {
        const startDate = new Date(lock.start_ts);
        const endDate = new Date(lock.end_ts);
        
        // Check if lock has matured
        if (now >= endDate) {
          // Calculate final accrued interest and mark as matured
          const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
          const dailyRate = lock.apy_applied / 365 / 100;
          const totalInterest = lock.amount_dec * dailyRate * totalDays;
          
          await supabase
            .from('locks')
            .update({
              status: 'matured',
              accrued_interest_dec: totalInterest
            })
            .eq('id', lock.id);
            
          console.log(`Lock ${lock.id} matured with interest: ${totalInterest}`);
          updatedLocks.push(lock.id);
        } else {
          // Calculate accrued interest up to today
          const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
          
          if (daysElapsed > 0) {
            const dailyRate = lock.apy_applied / 365 / 100;
            const accruedInterest = lock.amount_dec * dailyRate * daysElapsed;
            
            // No platform fee during accrual - fees collected at claim time
            
            await supabase
              .from('locks')
              .update({
                accrued_interest_dec: accruedInterest
              })
              .eq('id', lock.id);
              
            console.log(`Updated lock ${lock.id} with accrued interest: ${accruedInterest}`);
            updatedLocks.push(lock.id);
          }
        }
      } catch (lockError) {
        console.error(`Error processing lock ${lock.id}:`, lockError);
        // Continue processing other locks
      }
    }

    // Update pool statistics
    const { data: poolStats, error: poolError } = await supabase
      .from('pool_stats')
      .select('*');

    if (!poolError && poolStats) {
      for (const pool of poolStats) {
        // Recalculate utilization
        const utilization = pool.total_deposits_dec > 0 
          ? pool.total_borrowed_dec / pool.total_deposits_dec 
          : 0;

        await supabase
          .from('pool_stats')
          .update({
            utilization_fp: utilization,
            updated_ts: now.toISOString()
          })
          .eq('id', pool.id);
      }
    }

    console.log(`Accrual job completed. Updated ${updatedLocks.length} locks.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updatedLocks.length} locks`,
        updatedLocks
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in lending accrual function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});