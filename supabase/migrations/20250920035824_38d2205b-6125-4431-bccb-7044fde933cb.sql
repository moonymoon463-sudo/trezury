-- Bootstrap first admin user
-- This is a one-time migration to create the first admin user

INSERT INTO public.user_roles (user_id, role, assigned_by) 
SELECT 
  id, 
  'admin'::app_role, 
  id  -- Self-assigned for bootstrap
FROM public.profiles 
WHERE email = 'jjcarter433@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;