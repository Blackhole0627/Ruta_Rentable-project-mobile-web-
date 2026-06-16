-- Fix admin catalog 403 (vehicle save) on existing Supabase projects.
-- Run in SQL Editor, then logout/login in the app.
--
-- 1) Add admin email allowlist (edit the email below if needed):
INSERT INTO parameters (scope, user_id, key, value, unit)
VALUES ('global', NULL, 'adminEmails', 'blackhole45808@gmail.com', NULL)
ON CONFLICT (scope, user_id, key) DO UPDATE SET value = EXCLUDED.value;

-- 2) Promote logged-in user to admin when their email is in adminEmails
CREATE OR REPLACE FUNCTION promote_admin_if_allowed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  allowed text;
BEGIN
  user_email := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
  IF user_email = '' OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT value INTO allowed
    FROM parameters
   WHERE scope = 'global' AND user_id IS NULL AND key = 'adminEmails';

  IF allowed IS NULL OR NOT EXISTS (
    SELECT 1
      FROM unnest(string_to_array(allowed, ',')) AS e(raw)
     WHERE lower(trim(raw)) = user_email
  ) THEN
    RETURN;
  END IF;

  INSERT INTO users (id, email, name, role, updated_at)
  VALUES (auth.uid(), user_email, split_part(user_email, '@', 1), 'admin', now())
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin', email = EXCLUDED.email, updated_at = now();
END;
$$;

-- 3) Catalog write RPCs (bypass flaky RLS when is_admin() is true)
CREATE OR REPLACE FUNCTION admin_upsert_vehicle_catalog(p_entry jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO vehicle_catalog (
    id, unit_type, make, model, category, fuel_type, est_km_per_liter
  ) VALUES (
    COALESCE((p_entry->>'id')::uuid, gen_random_uuid()),
    COALESCE(p_entry->>'unit_type', 'car'),
    p_entry->>'make',
    p_entry->>'model',
    NULLIF(p_entry->>'category', ''),
    COALESCE(p_entry->>'fuel_type', 'gasoline'),
    COALESCE((p_entry->>'est_km_per_liter')::numeric, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    unit_type = EXCLUDED.unit_type,
    make = EXCLUDED.make,
    model = EXCLUDED.model,
    category = EXCLUDED.category,
    fuel_type = EXCLUDED.fuel_type,
    est_km_per_liter = EXCLUDED.est_km_per_liter;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_vehicle_catalog(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  DELETE FROM vehicle_catalog WHERE id = p_id;
END;
$$;

-- 4) RLS policies (idempotent)
DROP POLICY IF EXISTS "catalog_admin_write" ON vehicle_catalog;
DROP POLICY IF EXISTS "catalog_admin_insert" ON vehicle_catalog;
DROP POLICY IF EXISTS "catalog_admin_update" ON vehicle_catalog;
DROP POLICY IF EXISTS "catalog_admin_delete" ON vehicle_catalog;

CREATE POLICY "catalog_admin_insert" ON vehicle_catalog FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "catalog_admin_update" ON vehicle_catalog FOR UPDATE
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "catalog_admin_delete" ON vehicle_catalog FOR DELETE USING (is_admin());

GRANT EXECUTE ON FUNCTION promote_admin_if_allowed() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_upsert_vehicle_catalog(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_delete_vehicle_catalog(uuid) TO authenticated, service_role;

-- 5) One-time manual fix for your current admin account (edit email if needed):
UPDATE public.users SET role = 'admin' WHERE lower(email) = 'blackhole45808@gmail.com';
