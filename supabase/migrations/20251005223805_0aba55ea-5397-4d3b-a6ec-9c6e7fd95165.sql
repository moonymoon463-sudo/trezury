-- Fix quotes table constraint to allow SWAP operations
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_side_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_side_check 
  CHECK (side = ANY (ARRAY['BUY'::text, 'SELL'::text, 'SWAP'::text]));