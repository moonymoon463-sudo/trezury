-- Update execute_transaction function to handle platform fees
CREATE OR REPLACE FUNCTION public.execute_transaction(quote_id_param uuid, payment_method_param text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  quote_record RECORD;
  transaction_id UUID;
  execution_time TIMESTAMPTZ;
  platform_fee_usd NUMERIC;
  platform_fee_wallet TEXT := '0x742e4b5c0a2b4c1e9d8a7f6e5d4c3b2a1098765a';
  result JSON;
BEGIN
  execution_time := NOW();
  
  -- Get and validate quote
  SELECT * INTO quote_record 
  FROM quotes 
  WHERE id = quote_id_param 
    AND user_id = auth.uid() 
    AND expires_at > execution_time;
    
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Quote not found or expired'
    );
  END IF;
  
  -- Calculate platform fee (1% of transaction value)
  IF quote_record.side = 'buy' THEN
    platform_fee_usd := (quote_record.input_amount * 100) / 10000; -- 1% of input
  ELSE
    platform_fee_usd := (quote_record.output_amount * 100) / 10000; -- 1% of output
  END IF;
  
  -- Generate transaction ID
  transaction_id := gen_random_uuid();
  
  -- Insert transaction record
  INSERT INTO transactions (
    id,
    user_id,
    quote_id,
    type,
    asset,
    quantity,
    unit_price_usd,
    fee_usd,
    status,
    input_asset,
    output_asset,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    transaction_id,
    auth.uid(),
    quote_id_param,
    quote_record.side,
    CASE WHEN quote_record.side = 'buy' THEN quote_record.output_asset ELSE quote_record.input_asset END,
    quote_record.grams,
    quote_record.unit_price_usd,
    quote_record.fee_bps::numeric / 100, -- Convert bps to percentage for fee_usd calculation
    'completed',
    quote_record.input_asset,
    quote_record.output_asset,
    json_build_object(
      'payment_method', COALESCE(payment_method_param, 'wallet'),
      'quote_expires_at', quote_record.expires_at,
      'slippage_bps', 25,
      'minimum_received', quote_record.output_amount * 0.9975,
      'platform_fee_usd', platform_fee_usd,
      'platform_fee_wallet', platform_fee_wallet,
      'total_fee_bps', 150
    ),
    execution_time,
    execution_time
  );
  
  -- Update user balances
  IF quote_record.side = 'buy' THEN
    -- Buying gold: subtract USDC, add GOLD
    INSERT INTO balance_snapshots (user_id, asset, amount, snapshot_at)
    VALUES 
      (auth.uid(), 'USDC', -quote_record.input_amount, execution_time),
      (auth.uid(), 'XAUT', quote_record.grams, execution_time);
  ELSE
    -- Selling gold: subtract GOLD, add USDC  
    INSERT INTO balance_snapshots (user_id, asset, amount, snapshot_at)
    VALUES 
      (auth.uid(), 'XAUT', -quote_record.grams, execution_time),
      (auth.uid(), 'USDC', quote_record.output_amount, execution_time);
  END IF;
  
  -- Record platform fee collection (using a system user for platform fees)
  INSERT INTO balance_snapshots (user_id, asset, amount, snapshot_at)
  VALUES (
    auth.uid(), -- Still use user_id for RLS compliance, but mark as platform fee in metadata
    CASE WHEN quote_record.side = 'buy' THEN 'USDC' ELSE 'USDC' END, -- Platform fees in USDC
    platform_fee_usd,
    execution_time
  );
  
  -- Return success response
  result := json_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'quote', row_to_json(quote_record),
    'executed_at', execution_time,
    'platform_fee_usd', platform_fee_usd,
    'platform_fee_wallet', platform_fee_wallet
  );
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error response
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;