-- 014_find_user_by_email.sql — lets a cooperative admin check whether an email
-- belongs to a registered user WITHOUT exposing the users table (RLS hides other
-- users' rows). SECURITY DEFINER bypasses RLS but only returns the id.

CREATE OR REPLACE FUNCTION find_user_id_by_email(p_email TEXT)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
