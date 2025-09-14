-- Enable users to insert and update transactions
CREATE POLICY "Users can insert own transactions" ON public.transactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions  
FOR UPDATE USING (auth.uid() = user_id);

-- Enable users to insert quotes (needed for transaction execution)
CREATE POLICY "Users can insert own quotes" ON public.quotes
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable users to insert balance snapshots (for balance updates)
CREATE POLICY "Users can insert own balance snapshots" ON public.balance_snapshots
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add transaction execution function
CREATE OR REPLACE FUNCTION public.execute_transaction(
  quote_id_param UUID,
  payment_method_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quote_record RECORD;
  transaction_id UUID;
  execution_time TIMESTAMPTZ;
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
    quote_record.fee_usd,
    'completed',
    quote_record.input_asset,
    quote_record.output_asset,
    json_build_object(
      'payment_method', COALESCE(payment_method_param, 'wallet'),
      'quote_expires_at', quote_record.expires_at,
      'slippage_bps', 25,
      'minimum_received', quote_record.output_amount * 0.9975
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
      (auth.uid(), 'GOLD', quote_record.grams, execution_time);
  ELSE
    -- Selling gold: subtract GOLD, add USDC  
    INSERT INTO balance_snapshots (user_id, asset, amount, snapshot_at)
    VALUES 
      (auth.uid(), 'GOLD', -quote_record.grams, execution_time),
      (auth.uid(), 'USDC', quote_record.output_amount, execution_time);
  END IF;
  
  -- Return success response
  result := json_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'quote', row_to_json(quote_record),
    'executed_at', execution_time
  );
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error response
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;