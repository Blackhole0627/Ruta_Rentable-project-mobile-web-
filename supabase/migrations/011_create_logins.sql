-- 011_create_logins.sql — create the Admin + Driver login accounts.
-- Admin:  hassaankhalid@gmail.com  / 12345678   (role: admin)
-- Driver: hassaantech35@gmail.com  / 12345678   (role: driver)
-- Re-runnable: if a user already exists it just resets the password.
-- Run in the Supabase SQL Editor of the project your app's .env points to.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id  uuid;
  driver_id uuid;
BEGIN
  ----------------------------------------------------------------------------
  -- ADMIN
  ----------------------------------------------------------------------------
  SELECT id INTO admin_id FROM auth.users WHERE email = 'hassaankhalid@gmail.com';
  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'hassaankhalid@gmail.com', crypt('12345678', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      admin_id::text, admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'hassaankhalid@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt('12345678', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now())
     WHERE id = admin_id;
  END IF;

  ----------------------------------------------------------------------------
  -- DRIVER
  ----------------------------------------------------------------------------
  SELECT id INTO driver_id FROM auth.users WHERE email = 'hassaantech35@gmail.com';
  IF driver_id IS NULL THEN
    driver_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', driver_id, 'authenticated', 'authenticated',
      'hassaantech35@gmail.com', crypt('12345678', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      driver_id::text, driver_id,
      jsonb_build_object('sub', driver_id::text, 'email', 'hassaantech35@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt('12345678', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now())
     WHERE id = driver_id;
  END IF;

  ----------------------------------------------------------------------------
  -- public.users rows + roles (works whether or not the signup trigger fired)
  ----------------------------------------------------------------------------
  INSERT INTO public.users (id, email, name, registered_at, updated_at, role, subscription_status, current_plan, free_calculations_used)
  VALUES (admin_id, 'hassaankhalid@gmail.com', 'Administrador', now(), now(), 'admin', 'active', 'pro', 0)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;

  INSERT INTO public.users (id, email, name, registered_at, updated_at, role, subscription_status, current_plan, free_calculations_used)
  VALUES (driver_id, 'hassaantech35@gmail.com', 'Conductor Demo', now(), now(), 'driver', 'active', 'basic', 0)
  ON CONFLICT (id) DO UPDATE SET role = 'driver', email = EXCLUDED.email;
END $$;

-- Verify:
--   SELECT email, role FROM public.users WHERE email IN ('hassaankhalid@gmail.com','hassaantech35@gmail.com');
