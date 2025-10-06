-- Fix security definer view issue for reconciliation_alerts_summary
-- Set security_invoker=on to respect RLS policies

ALTER VIEW reconciliation_alerts_summary SET (security_invoker = on);