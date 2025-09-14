-- Enable leaked password protection
UPDATE auth.config 
SET 
  password_min_length = 8,
  password_require_letters = true,
  password_require_numbers = true,
  password_require_symbols = false,
  password_require_uppercase = false,
  enable_leaked_password_protection = true;