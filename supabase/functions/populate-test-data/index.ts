import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Test user scenarios for realistic lending data
const TEST_SCENARIOS = [
  {
    scenario: 'Conservative Supplier',
    supplies: [
      { asset: 'USDC', chain: 'ethereum', amount: 10000, rate: 0.055 },
      { asset: 'USDT', chain: 'ethereum', amount: 5000, rate: 0.055 }
    ],
    borrows: []
  },
  {
    scenario: 'Leveraged Gold Trader',
    supplies: [
      { asset: 'XAUT', chain: 'ethereum', amount: 50, rate: 0.045 },
      { asset: 'USDC', chain: 'ethereum', amount: 15000, rate: 0.055 }
    ],
    borrows: [
      { asset: 'USDT', chain: 'ethereum', amount: 8000, rate: 0.075, type: 'variable' }
    ]
  },
  {
    scenario: 'DeFi Power User',
    supplies: [
      { asset: 'AURU', chain: 'ethereum', amount: 1000, rate: 0.08 },
      { asset: 'DAI', chain: 'ethereum', amount: 25000, rate: 0.055 }
    ],
    borrows: [
      { asset: 'USDC', chain: 'ethereum', amount: 12000, rate: 0.075, type: 'variable' },
      { asset: 'XAUT', chain: 'ethereum', amount: 8, rate: 0.065, type: 'stable' }
    ]
  },
  {
    scenario: 'Yield Farmer',
    supplies: [
      { asset: 'USDC', chain: 'base', amount: 50000, rate: 0.055 },
      { asset: 'USDT', chain: 'base', amount: 30000, rate: 0.055 }
    ],
    borrows: [
      { asset: 'DAI', chain: 'ethereum', amount: 20000, rate: 0.075, type: 'variable' }
    ]
  },
  {
    scenario: 'High Risk Trader',
    supplies: [
      { asset: 'XAUT', chain: 'ethereum', amount: 20, rate: 0.045 },
      { asset: 'AURU', chain: 'ethereum', amount: 500, rate: 0.08 }
    ],
    borrows: [
      { asset: 'USDC', chain: 'ethereum', amount: 35000, rate: 0.075, type: 'variable' },
      { asset: 'USDT', chain: 'ethereum', amount: 15000, rate: 0.075, type: 'variable' }
    ]
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc('is_admin', { _user_id: user.id });
    
    if (!isAdmin) {
      console.warn(`Unauthorized access attempt to populate-test-data by user: ${user.id}`);
      await supabaseAdmin.rpc('log_security_event', {
        event_type: 'unauthorized_admin_function_access',
        event_data: {
          function: 'populate-test-data',
          user_id: user.id,
          timestamp: new Date().toISOString()
        }
      });
      
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting test data population (by admin: ${user.id})...`);

    // Get authenticated users to assign positions to
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .limit(10);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({
        error: 'No user profiles found. Please sign up users first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = {
      supplies_created: 0,
      borrows_created: 0,
      users_populated: 0,
      flash_loans_created: 0,
      liquidation_auctions_created: 0
    };

    // Create user positions for each test scenario
    for (let i = 0; i < Math.min(TEST_SCENARIOS.length, profiles.length); i++) {
      const user = profiles[i];
      const scenario = TEST_SCENARIOS[i];
      
      console.log(`Creating ${scenario.scenario} positions for user ${user.email}`);

      // Create supplies
      for (const supply of scenario.supplies) {
        const { error: supplyError } = await supabaseAdmin
          .from('user_supplies')
          .insert({
            user_id: user.id,
            asset: supply.asset,
            chain: supply.chain,
            supplied_amount_dec: supply.amount,
            supply_rate_at_deposit: supply.rate,
            accrued_interest_dec: supply.amount * supply.rate * 0.1, // 10% of yearly interest
            used_as_collateral: true,
            last_interest_update: new Date().toISOString()
          });

        if (supplyError) {
          console.error('Supply creation error:', supplyError);
        } else {
          results.supplies_created++;
        }
      }

      // Create borrows
      for (const borrow of scenario.borrows) {
        const { error: borrowError } = await supabaseAdmin
          .from('user_borrows')
          .insert({
            user_id: user.id,
            asset: borrow.asset,
            chain: borrow.chain,
            borrowed_amount_dec: borrow.amount,
            borrow_rate_at_time: borrow.rate,
            rate_mode: borrow.type,
            accrued_interest_dec: borrow.amount * borrow.rate * 0.05, // 5% of yearly interest
            last_interest_update: new Date().toISOString()
          });

        if (borrowError) {
          console.error('Borrow creation error:', borrowError);
        } else {
          results.borrows_created++;
        }
      }

      results.users_populated++;
    }

    // Create sample flash loan opportunities
    const flashLoanOpportunities = [
      {
        asset: 'USDC',
        chain: 'ethereum',
        amount_dec: 100000,
        opportunity_type: 'arbitrage',
        profit_dec: 250,
        fee_dec: 30,
        execution_status: 'completed',
        user_id: profiles[0].id,
        metadata: {
          source_dex: 'Uniswap',
          target_dex: 'SushiSwap',
          price_diff_bps: 25
        }
      },
      {
        asset: 'DAI',
        chain: 'ethereum',
        amount_dec: 50000,
        opportunity_type: 'liquidation',
        profit_dec: 1200,
        fee_dec: 150,
        execution_status: 'completed',
        user_id: profiles[1]?.id || profiles[0].id,
        metadata: {
          liquidated_user: 'high_risk_position',
          collateral_seized: 'XAUT',
          liquidation_bonus: 0.05
        }
      }
    ];

    for (const flashLoan of flashLoanOpportunities) {
      const { error: flashError } = await supabaseAdmin
        .from('flash_loan_history')
        .insert(flashLoan);

      if (flashError) {
        console.error('Flash loan creation error:', flashError);
      } else {
        results.flash_loans_created++;
      }
    }

    // Create sample liquidation auctions
    const liquidationAuctions = [
      {
        target_user_id: profiles[profiles.length - 1]?.id || profiles[0].id,
        collateral_asset: 'XAUT',
        collateral_amount_dec: 15,
        debt_asset: 'USDC',
        debt_amount_dec: 25000,
        chain: 'ethereum',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        current_bid_amount_dec: 24000,
        current_bidder_id: profiles[1]?.id,
        status: 'active'
      }
    ];

    for (const auction of liquidationAuctions) {
      const { error: auctionError } = await supabaseAdmin
        .from('liquidation_auctions')
        .insert(auction);

      if (auctionError) {
        console.error('Liquidation auction creation error:', auctionError);
      } else {
        results.liquidation_auctions_created++;
      }
    }

    // Trigger health factor calculations
    console.log('Triggering health factor calculations...');
    try {
      await supabaseAdmin.functions.invoke('health-factor-monitor');
      console.log('Health factor calculations completed');
    } catch (error) {
      console.log('Health factor calculation warning:', error);
    }

    // Update real-time rates
    console.log('Updating real-time rates...');
    try {
      await supabaseAdmin.functions.invoke('real-time-rates');
      console.log('Rate updates completed');
    } catch (error) {
      console.log('Rate update warning:', error);
    }

    return new Response(JSON.stringify({
      message: 'Test data population completed successfully',
      results: results,
      scenarios_created: TEST_SCENARIOS.slice(0, profiles.length).map(s => s.scenario),
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in populate-test-data function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});