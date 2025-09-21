-- Enable leaked password protection for better security
UPDATE auth.config 
SET password_min_length = 6;

-- Enable password strength requirements
INSERT INTO auth.config (parameter, value) VALUES ('password_strength', 'strong') 
ON CONFLICT (parameter) DO UPDATE SET value = 'strong';

-- Enable leaked password protection
INSERT INTO auth.config (parameter, value) VALUES ('password_leaked_protection', 'true') 
ON CONFLICT (parameter) DO UPDATE SET value = 'true';