-- Enable leaked password protection for enhanced security
UPDATE auth.config SET leaked_password_protection = true WHERE id = 1;