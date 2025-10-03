-- Grant permissions on v_profiles_masked view to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.v_profiles_masked TO authenticated;