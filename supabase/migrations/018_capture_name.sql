-- 018_capture_name.sql — capture the user's name on signup. Works for both
-- email/password signup (we pass `name` in user metadata) and Google sign-in
-- (Google provides `name` / `full_name`).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, email, name, registered_at, updated_at,
    role, subscription_status, current_plan, free_calculations_used
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(
      NULLIF(new.raw_user_meta_data ->> 'name', ''),
      NULLIF(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    now(), now(),
    'driver', 'trial', 'free', 0
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name);
  RETURN new;
END;
$$;
