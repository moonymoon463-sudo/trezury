-- Create database trigger to automatically generate fee collection requests for swap transactions
-- This ensures no fees are missed even if the bot is down

CREATE OR REPLACE FUNCTION public.auto_generate_fee_collection_request()
RETURNS TRIGGER AS $$
DECLARE
  v_platform_fee_usd NUMERIC;
  v_platform_fee_asset TEXT;
  v_platform_fee_collected BOOLEAN;
  v_user_address TEXT;
BEGIN
  -- Only process completed swap transactions
  IF NEW.status = 'completed' AND NEW.type = 'swap' THEN
    -- Extract fee metadata
    v_platform_fee_usd := (NEW.metadata->>'platform_fee_usd')::NUMERIC;
    v_platform_fee_asset := NEW.metadata->>'platform_fee_asset';
    v_platform_fee_collected := COALESCE((NEW.metadata->>'platform_fee_collected')::BOOLEAN, false);
    
    -- Only create request if fee exists and hasn't been collected
    IF v_platform_fee_usd > 0 AND NOT v_platform_fee_collected THEN
      -- Get user's wallet address
      SELECT address INTO v_user_address
      FROM public.onchain_addresses
      WHERE user_id = NEW.user_id
        AND status = 'active'
        AND is_primary = true
      LIMIT 1;
      
      -- Create fee collection request if we have a valid address
      IF v_user_address IS NOT NULL THEN
        INSERT INTO public.fee_collection_requests (
          transaction_id,
          user_id,
          from_address,
          to_address,
          amount,
          asset,
          status,
          chain,
          metadata
        ) VALUES (
          NEW.id,
          NEW.user_id,
          v_user_address,
          '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835', -- Platform wallet
          v_platform_fee_usd,
          v_platform_fee_asset,
          'pending',
          'ethereum',
          jsonb_build_object(
            'auto_generated', true,
            'trigger_time', now(),
            'transaction_type', NEW.type,
            'tx_hash', NEW.tx_hash
          )
        )
        ON CONFLICT (transaction_id) DO NOTHING; -- Prevent duplicates
        
        -- Log the request creation
        RAISE NOTICE 'Auto-generated fee collection request for transaction %: % % from user %', 
          NEW.id, v_platform_fee_usd, v_platform_fee_asset, NEW.user_id;
      ELSE
        -- Log warning if no wallet address found
        RAISE WARNING 'Cannot create fee collection request for transaction %: No active wallet address for user %', 
          NEW.id, NEW.user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS trigger_auto_fee_collection ON public.transactions;
CREATE TRIGGER trigger_auto_fee_collection
  AFTER INSERT OR UPDATE OF status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_fee_collection_request();

-- Add comment
COMMENT ON FUNCTION public.auto_generate_fee_collection_request() IS 
  'Automatically generates fee collection requests when swap transactions complete. Ensures no platform fees are missed.';

-- Add unique constraint to prevent duplicate fee requests for same transaction
ALTER TABLE public.fee_collection_requests
  DROP CONSTRAINT IF EXISTS fee_collection_requests_transaction_id_key;

ALTER TABLE public.fee_collection_requests
  ADD CONSTRAINT fee_collection_requests_transaction_id_key 
  UNIQUE (transaction_id);