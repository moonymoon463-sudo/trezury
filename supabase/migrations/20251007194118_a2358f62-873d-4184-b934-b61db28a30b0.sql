-- Create support tickets table
CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  issue_type text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  screenshot_url text,
  status text NOT NULL DEFAULT 'open',
  priority text DEFAULT 'normal',
  assigned_to uuid REFERENCES auth.users(id),
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  
  CONSTRAINT valid_issue_types CHECK (issue_type IN (
    'login_issue', 'transaction_issue', 'payment_issue', 
    'kyc_issue', 'wallet_issue', 'technical_issue', 'other'
  )),
  CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Create support ticket replies table
CREATE TABLE support_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  is_admin boolean DEFAULT false,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Generate unique ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  year_prefix text;
  sequence_num integer;
  ticket_num text;
BEGIN
  year_prefix := 'TRZ-' || EXTRACT(YEAR FROM NOW())::text || '-';
  
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM support_tickets
  WHERE ticket_number LIKE year_prefix || '%';
  
  ticket_num := year_prefix || LPAD(sequence_num::text, 4, '0');
  
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket numbers
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_support_ticket_number
BEFORE INSERT ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION set_ticket_number();

-- Auto-update timestamp
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Notify user when ticket status changes
CREATE OR REPLACE FUNCTION notify_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (user_id, title, body, kind, priority, action_url)
    VALUES (
      NEW.user_id,
      'Support Ticket Updated',
      'Your support ticket #' || NEW.ticket_number || ' status changed to: ' || NEW.status,
      'support_update',
      'info',
      '/support/tickets/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_status_notification
AFTER UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION notify_ticket_status_change();

-- RLS Policies for support_tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
ON support_tickets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
ON support_tickets FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own tickets"
ON support_tickets FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
ON support_tickets FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all tickets"
ON support_tickets FOR UPDATE
USING (is_admin(auth.uid()));

-- RLS Policies for support_ticket_replies
ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view replies on their tickets"
ON support_ticket_replies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_ticket_replies.ticket_id
    AND support_tickets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create replies on their tickets"
ON support_ticket_replies FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_ticket_replies.ticket_id
    AND support_tickets.user_id = auth.uid()
  )
  AND auth.uid() = user_id
);

CREATE POLICY "Admins can view all replies"
ON support_ticket_replies FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can create replies"
ON support_ticket_replies FOR INSERT
WITH CHECK (is_admin(auth.uid()) AND is_admin = true);

-- Create storage bucket for support screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-screenshots', 'support-screenshots', false);

-- Storage RLS policies
CREATE POLICY "Users can upload their support screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'support-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'support-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all support screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'support-screenshots' AND
  is_admin(auth.uid())
);

-- Enable realtime for ticket replies
ALTER PUBLICATION supabase_realtime ADD TABLE support_ticket_replies;