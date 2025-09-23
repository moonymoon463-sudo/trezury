import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const webhookData = await req.json()
    console.log('MoonPay webhook received:', webhookData)

    const { type, data } = webhookData

    // Handle transaction updates (purchases)
    if (type === 'transaction_updated') {
      const { id, status, baseCurrencyAmount, currencyAmount, externalCustomerId } = data

      // Update payment transaction status
      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('external_id', id)

      if (updateError) {
        console.error('Failed to update payment transaction:', updateError)
      }

      // If transaction completed, add USDC to user balance
      if (status === 'completed') {
        console.log('Transaction completed, adding USDC to balance:', {
          userId: externalCustomerId,
          amount: currencyAmount
        })

        const { error: balanceError } = await supabase
          .from('balance_snapshots')
          .insert({
            user_id: externalCustomerId,
            asset: 'USDC',
            amount: currencyAmount,
            snapshot_at: new Date().toISOString()
          })

        if (balanceError) {
          console.error('Failed to update user balance:', balanceError)
        } else {
          console.log('Successfully added USDC to user balance')
        }
      }
    }

    // Handle customer KYC status updates
    if (type === 'customer_updated') {
      const { id: customerId, identityStatus, externalCustomerId } = data
      
      console.log('Customer KYC status update:', {
        customerId,
        identityStatus,
        externalCustomerId
      })

      if (externalCustomerId && identityStatus) {
        let kycStatus = 'pending'
        let kycVerifiedAt = null

        // Map MoonPay identity statuses to our KYC status
        switch (identityStatus) {
          case 'verified':
          case 'passed':
            kycStatus = 'verified'
            kycVerifiedAt = new Date().toISOString()
            break
          case 'failed':
          case 'rejected':
            kycStatus = 'rejected'
            break
          case 'pending':
          case 'review':
            kycStatus = 'pending'
            break
        }

        // Update user profile with KYC status
        const { error: kycUpdateError } = await supabase
          .from('profiles')
          .update({
            kyc_status: kycStatus,
            kyc_verified_at: kycVerifiedAt,
            metadata: {
              moonpay_customer_id: customerId,
              moonpay_identity_status: identityStatus,
              kyc_flow: 'moonpay'
            }
          })
          .eq('id', externalCustomerId)

        if (kycUpdateError) {
          console.error('Failed to update KYC status:', kycUpdateError)
        } else {
          console.log(`Successfully updated KYC status to ${kycStatus} for user ${externalCustomerId}`)
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('MoonPay webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})