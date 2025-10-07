import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-moonpay-signature',
}

// In-memory store for idempotency (in production, use Redis or database)
const processedWebhooks = new Map<string, Date>()

// Rate limiting per IP (simple in-memory - use Redis in production)
const rateLimitStore = new Map<string, { count: number, resetTime: number }>()

// Webhook signature verification
async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const messageData = encoder.encode(body)
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    // Remove 'sha256=' prefix if present
    const providedSignature = signature.replace('sha256=', '')
    
    return expectedSignature === providedSignature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

// Rate limiting check
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = rateLimitStore.get(ip)
  
  if (!limit || now > limit.resetTime) {
    // Reset window (5 minutes)
    rateLimitStore.set(ip, { count: 1, resetTime: now + 300000 })
    return true
  }
  
  if (limit.count >= 100) { // 100 requests per 5 minutes
    return false
  }
  
  limit.count++
  return true
}

// Idempotency check
function checkIdempotency(webhookId: string): boolean {
  const now = new Date()
  const existingProcess = processedWebhooks.get(webhookId)
  
  if (existingProcess) {
    // Check if it's within 24 hours (idempotency window)
    const hoursDiff = (now.getTime() - existingProcess.getTime()) / (1000 * 60 * 60)
    if (hoursDiff < 24) {
      return false // Already processed
    }
  }
  
  processedWebhooks.set(webhookId, now)
  
  // Clean up old entries (keep only last 24 hours)
  for (const [id, timestamp] of processedWebhooks.entries()) {
    const hoursDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)
    if (hoursDiff >= 24) {
      processedWebhooks.delete(id)
    }
  }
  
  return true
}

// Enhanced logging
async function logWebhookEvent(supabase: any, eventType: string, data: any, status: 'success' | 'error', error?: string) {
  try {
    await supabase.rpc('record_system_metric', {
      p_metric_name: `moonpay_webhook_${eventType}`,
      p_metric_value: status === 'success' ? 1 : 0,
      p_metric_unit: 'status'
    })

    // Log to security monitoring if error
    if (status === 'error') {
      await supabase.rpc('trigger_security_alert', {
        p_event_type: 'webhook_processing_error',
        p_severity: 'high',
        p_event_data: { 
          event_type: eventType,
          error_message: error,
          webhook_data: data,
          timestamp: new Date().toISOString()
        }
      })
    }
  } catch (logError) {
    console.error('Failed to log webhook event:', logError)
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now()
  let webhookBody = ''
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get client IP for rate limiting
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown'

    // Rate limiting check
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`)
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get webhook body
    webhookBody = await req.text()
    const webhookData = JSON.parse(webhookBody)
    
    console.log('MoonPay webhook received:', {
      type: webhookData.type,
      id: webhookData.data?.id,
      timestamp: new Date().toISOString(),
      ip: clientIP
    })

    // Webhook signature verification - MANDATORY
    const webhookSecret = Deno.env.get('MOONPAY_WEBHOOK_SECRET')
    
    if (!webhookSecret) {
      console.error('❌ MOONPAY_WEBHOOK_SECRET not configured - rejecting webhook')
      await logWebhookEvent(supabase, 'configuration_error', webhookData, 'error', 'Webhook secret not configured')
      return new Response(
        JSON.stringify({ error: 'Webhook verification not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const signature = req.headers.get('x-moonpay-signature')
    if (!signature) {
      console.error('❌ Missing webhook signature')
      await logWebhookEvent(supabase, webhookData.type || 'unknown', webhookData, 'error', 'Missing signature')
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const isValid = await verifyWebhookSignature(webhookBody, signature, webhookSecret)
    if (!isValid) {
      console.error('❌ Invalid webhook signature')
      await logWebhookEvent(supabase, webhookData.type || 'unknown', webhookData, 'error', 'Invalid signature')
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('✅ Webhook signature verified')

    const { type, data } = webhookData
    const webhookId = `${type}_${data?.id}_${Date.now()}`

    // Idempotency check
    if (!checkIdempotency(webhookId)) {
      console.log('Webhook already processed:', webhookId)
      return new Response(
        JSON.stringify({ received: true, status: 'already_processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle transaction updates (purchases/sales)
    if (type === 'transaction_updated') {
      const { id, status, baseCurrencyAmount, currencyAmount, cryptoAmount, externalCustomerId } = data
      
      console.log('Processing transaction update:', {
        transactionId: id,
        status,
        userId: externalCustomerId,
        amount: currencyAmount || cryptoAmount
      })

      // Update payment transaction status with retry logic
      let retryCount = 0
      const maxRetries = 3
      
      while (retryCount < maxRetries) {
        try {
          const { error: updateError } = await supabase
            .from('payment_transactions')
            .update({
              status: status,
              updated_at: new Date().toISOString(),
              metadata: {
                webhook_processed_at: new Date().toISOString(),
                webhook_retry_count: retryCount,
                base_currency_amount: baseCurrencyAmount,
                crypto_amount: cryptoAmount || currencyAmount
              }
            })
            .eq('external_id', id)

          if (!updateError) break
          
          retryCount++
          if (retryCount === maxRetries) {
            throw updateError
          }
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
        } catch (error) {
          if (retryCount === maxRetries) throw error
        }
      }

      // If transaction completed, process balance and transaction updates
      if (status === 'completed' && externalCustomerId) {
        const amount = cryptoAmount || currencyAmount
        const baseAmount = baseCurrencyAmount
        
        console.log('Transaction completed, updating balances:', {
          userId: externalCustomerId,
          amount,
          baseAmount
        })

        // Add USDC to user balance
        const { error: balanceError } = await supabase
          .from('balance_snapshots')
          .insert({
            user_id: externalCustomerId,
            asset: 'USDC',
            amount: amount,
            snapshot_at: new Date().toISOString()
          })

        if (balanceError) {
          console.error('Failed to update user balance:', balanceError)
          throw balanceError
        }

        // Create transaction record for MoonPay purchase
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: externalCustomerId,
            type: 'buy',
            asset: 'USDC',
            quantity: amount,
            unit_price_usd: baseAmount / amount,
            fee_usd: 0, // MoonPay fees are included in the spread
            status: 'completed',
            input_asset: 'USD',
            output_asset: 'USDC',
            metadata: {
              provider: 'moonpay',
              external_transaction_id: id,
              base_currency_amount: baseAmount,
              crypto_amount: amount,
              transaction_source: 'moonpay_purchase',
              payment_method: 'fiat',
              processed_at: new Date().toISOString(),
              webhook_id: webhookId
            }
          })

        if (transactionError) {
          console.error('Failed to create transaction record:', transactionError)
          throw transactionError
        }

        // Transaction completed - no notification (profile-only notifications)

        console.log('✅ Successfully processed completed transaction')
      }
    }

    // Handle customer KYC status updates
    else if (type === 'customer_updated') {
      const { id: customerId, identityStatus, externalCustomerId } = data
      
      console.log('Processing customer KYC update:', {
        customerId,
        identityStatus,
        externalCustomerId
      })

      if (externalCustomerId && identityStatus) {
        let kycStatus = 'pending'
        let kycVerifiedAt = null
        let kycRejectionReason = null

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
            kycRejectionReason = 'Identity verification failed via MoonPay'
            break
          case 'pending':
          case 'review':
          case 'processing':
            kycStatus = 'pending'
            break
        }

        // Update user profile with KYC status
        const { error: kycUpdateError } = await supabase
          .from('profiles')
          .update({
            kyc_status: kycStatus,
            kyc_verified_at: kycVerifiedAt,
            kyc_rejection_reason: kycRejectionReason,
            metadata: {
              moonpay_customer_id: customerId,
              moonpay_identity_status: identityStatus,
              kyc_flow: 'moonpay',
              kyc_updated_at: new Date().toISOString()
            }
          })
          .eq('id', externalCustomerId)

        if (kycUpdateError) {
          console.error('Failed to update KYC status:', kycUpdateError)
          throw kycUpdateError
        }

        // Create KYC notification (profile-related)
        if (kycStatus === 'verified') {
          const notificationTitle = 'Identity Verified'
          const notificationBody = 'Congratulations! Your identity has been successfully verified. You\'re all set to start using the app!'

          await supabase
            .from('notifications')
            .insert({
              user_id: externalCustomerId,
              title: notificationTitle,
              body: notificationBody,
              kind: 'kyc_verified',
              priority: 'info',
              metadata: {
                kyc_status: kycStatus,
                moonpay_customer_id: customerId
              }
            })
        }

        console.log(`✅ Successfully updated KYC status to ${kycStatus} for user ${externalCustomerId}`)
      }
    }

    // Handle refund updates
    else if (type === 'refund_updated') {
      const { id: refundId, status, transactionId, amount, externalCustomerId } = data
      
      console.log('Processing refund update:', {
        refundId,
        status,
        transactionId,
        amount
      })

      if (status === 'completed' && externalCustomerId) {
        // Create refund transaction record
        await supabase
          .from('transactions')
          .insert({
            user_id: externalCustomerId,
            type: 'refund',
            asset: 'USD',
            quantity: amount,
            unit_price_usd: 1,
            status: 'completed',
            metadata: {
              provider: 'moonpay',
              refund_id: refundId,
              original_transaction_id: transactionId,
              transaction_source: 'moonpay_refund',
              processed_at: new Date().toISOString()
            }
          })
          

        // Refund completed - no notification (profile-only notifications)
      }
    }

      // Handle failed transactions
      else if (type === 'transaction_failed') {
        const { id, failureReason, externalCustomerId } = data
        
        console.log('Processing failed transaction:', {
          transactionId: id,
          failureReason,
          userId: externalCustomerId
        })

        // Update payment transaction status to failed
        await supabase
          .from('payment_transactions')
          .update({
            status: 'failed',
            metadata: {
              failure_reason: failureReason,
              failed_at: new Date().toISOString()
            }
          })
          .eq('external_id', id)

        // Also update moonpay_transactions if it exists
        await supabase
          .from('moonpay_transactions')
          .update({
            status: 'failed',
            raw_webhook: webhookData,
            updated_at: new Date().toISOString()
          })
          .eq('moonpay_tx_id', id)

        // Transaction failed - no notification (profile-only notifications)
      }

      // Handle recurring transaction events
      else if (type === 'recurring_purchase_updated') {
        const { id, status, amount, currency, cryptoCurrency, externalCustomerId, recurringScheduleId } = data
        
        console.log('Processing recurring purchase update:', {
          recurringPurchaseId: id,
          status,
          scheduleId: recurringScheduleId,
          userId: externalCustomerId
        })

        if (externalCustomerId) {
          // Update or insert moonpay_transactions record
          const { error: upsertError } = await supabase
            .from('moonpay_transactions')
            .upsert({
              user_id: externalCustomerId,
              moonpay_tx_id: id,
              asset_symbol: cryptoCurrency?.toUpperCase() || 'UNKNOWN',
              amount_fiat: amount,
              currency_fiat: currency?.toUpperCase(),
              status: status,
              is_recurring: true,
              raw_webhook: webhookData,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'moonpay_tx_id'
            })

          if (upsertError) {
            console.error('Failed to update recurring transaction:', upsertError)
            throw upsertError
          }

          // Store webhook for audit
          await supabase
            .from('moonpay_webhooks')
            .insert({
              event_type: type,
              payload: webhookData,
              signature: signature || null
            })

          console.log('✅ Successfully processed recurring purchase update')
        }
      }

    // Store webhook for audit (for all webhook types)
    await supabase
      .from('moonpay_webhooks')
      .insert({
        event_type: type,
        payload: webhookData,
        signature: signature || null
      })

    // Log successful processing
    await logWebhookEvent(supabase, type, data, 'success')
    
    const processingTime = Date.now() - startTime
    console.log(`✅ Webhook processed successfully in ${processingTime}ms`)

    return new Response(
      JSON.stringify({ 
        received: true, 
        processed_at: new Date().toISOString(),
        processing_time_ms: processingTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('MoonPay webhook error:', error)
    
    // Log error and insert into DLQ
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const webhookData = webhookBody ? JSON.parse(webhookBody) : {}
      await logWebhookEvent(supabase, webhookData.type || 'unknown', webhookData, 'error', error instanceof Error ? error.message : 'Unknown error')
      
      // Check if this is a replay attempt from DLQ
      const isReplay = req.headers.get('x-replay-from-dlq') === 'true'
      
      // Insert into DLQ if not a replay and has valid webhook data
      if (!isReplay && webhookData.type && webhookData.data) {
        const signature = req.headers.get('x-moonpay-signature')
        const webhookId = `${webhookData.type}_${webhookData.data?.id}_${Date.now()}`
        
        console.warn('⚠️ Inserting failed webhook into DLQ:', webhookId)
        
        const { error: dlqError } = await supabase
          .from('webhook_dlq')
          .insert({
            webhook_id: webhookId,
            event_type: webhookData.type,
            payload: webhookData,
            signature: signature || null,
            retry_count: 3, // Max retries reached
            last_error: error instanceof Error ? error.message : 'Unknown error',
            error_details: {
              error_name: error instanceof Error ? error.name : 'Error',
              error_stack: error instanceof Error ? error.stack : undefined,
              processing_time_ms: processingTime,
              timestamp: new Date().toISOString()
            },
            original_timestamp: new Date().toISOString(),
            metadata: {
              client_ip: req.headers.get('cf-connecting-ip') || 
                         req.headers.get('x-forwarded-for') || 
                         'unknown'
            }
          })
        
        if (dlqError) {
          console.error('Failed to insert into DLQ:', dlqError)
        } else {
          console.log('✅ Failed webhook saved to DLQ for manual replay')
        }
      }
    } catch (logError) {
      console.error('Failed to log error or insert DLQ:', logError)
    }

    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed',
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
