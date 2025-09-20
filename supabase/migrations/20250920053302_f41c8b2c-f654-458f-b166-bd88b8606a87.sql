-- Add chain field to fee_collection_requests table for cross-chain fee tracking
ALTER TABLE fee_collection_requests 
ADD COLUMN IF NOT EXISTS chain text DEFAULT 'ethereum';