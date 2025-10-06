-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create their own transaction intents" ON transaction_intents;
DROP POLICY IF EXISTS "Users can view their own transaction intents" ON transaction_intents;
DROP POLICY IF EXISTS "Users can update their own transaction intents" ON transaction_intents;
DROP POLICY IF EXISTS "Service role can manage all transaction intents" ON transaction_intents;
DROP POLICY IF EXISTS "Admins can view all transaction intents" ON transaction_intents;

-- Enable RLS on transaction_intents table
ALTER TABLE transaction_intents ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can insert their own transaction intents
CREATE POLICY "Users can create their own transaction intents"
  ON transaction_intents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Users can view their own transaction intents
CREATE POLICY "Users can view their own transaction intents"
  ON transaction_intents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 3: Users can update their own transaction intents
CREATE POLICY "Users can update their own transaction intents"
  ON transaction_intents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Service role can manage all transaction intents (for reconciliation)
CREATE POLICY "Service role can manage all transaction intents"
  ON transaction_intents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 5: Admins can view all transaction intents (for monitoring)
CREATE POLICY "Admins can view all transaction intents"
  ON transaction_intents
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));