-- 012_fix_auth_login.sql — fixes "Database error querying schema" / 500 on login.
-- Manually-inserted auth.users rows leave token columns NULL, which GoTrue
-- cannot read (it expects ''). This sets them to '' and re-confirms passwords.
-- Run in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Core token columns (exist in all versions).
UPDATE auth.users SET
  confirmation_token     = COALESCE(confirmation_token, ''),
  recovery_token         = COALESCE(recovery_token, ''),
  email_change           = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, '');

-- 2) Newer token columns (run separately so a missing column doesn't undo step 1).
UPDATE auth.users SET
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '');

-- 3) Make sure our two accounts have the right password + are confirmed.
UPDATE auth.users SET
  encrypted_password = crypt('12345678', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email IN ('hassaankhalid@gmail.com', 'hassaantech35@gmail.com');
