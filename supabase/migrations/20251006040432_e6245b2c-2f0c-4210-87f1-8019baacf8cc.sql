-- Add new columns to notifications table for enhanced functionality
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS action_url TEXT,
ADD COLUMN IF NOT EXISTS icon TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'info';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_notifications_created 
ON notifications(created_at DESC);