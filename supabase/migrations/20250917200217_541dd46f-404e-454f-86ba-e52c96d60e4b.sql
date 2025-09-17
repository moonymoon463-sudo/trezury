-- Drop the public_profiles view that exposes sensitive PII
DROP VIEW IF EXISTS public_profiles;

-- Revoke all public privileges on tables to prevent unauthorized access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM public;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM public;

-- Ensure only authenticated users can access tables through RLS policies
-- (RLS policies are already in place for proper access control)