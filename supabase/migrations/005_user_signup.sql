-- 005_user_signup.sql — auto-provision a public.users row on auth signup,
-- and provide the admin-promotion command.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, email, registered_at, updated_at,
    role, subscription_status, current_plan, free_calculations_used
  )
  VALUES (
    new.id, new.email, now(), now(),
    'driver', 'trial', 'free', 0
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- After the admin signs in once, promote them (replace the email):
--   UPDATE public.users SET role = 'admin' WHERE email = 'admin@rutarentable.com';
