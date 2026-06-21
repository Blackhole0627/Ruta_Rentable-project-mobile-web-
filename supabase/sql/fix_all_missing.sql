-- =============================================================================
-- RutaRentable — FIX ALL MISSING PIECES (run once in Supabase SQL Editor)
-- =============================================================================
-- Verified missing on the live project (lvposxnatygyzwuvfxzp):
--   • kyc_submissions table + kyc-docs private bucket   (KYC feature)
--   • admin_upsert/delete_vehicle_catalog + promote_admin_if_allowed
--   • trips RLS WITH CHECK (safety)
--
-- Every statement is idempotent — safe to re-run. After it succeeds, log OUT
-- and back IN inside the app so the admin role refreshes.
--
-- ⚠️ Agar aapka admin email 'blackhole45808@gmail.com' se alag hai, neeche
--    do jagah (PART B step 1 aur step 5) email badal dein.
-- =============================================================================


-- ============================ PART A — trips RLS =============================
DROP POLICY IF EXISTS "own_trips" ON trips;
CREATE POLICY "own_trips" ON trips FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ===================== PART B — admin catalog + admin role ===================
-- 1) Admin email allowlist  (👈 edit email if needed)
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

-- 5) One-time manual fix for your current admin account  (👈 edit email if needed)
UPDATE public.users SET role = 'admin' WHERE lower(email) = 'blackhole45808@gmail.com';


-- ============================ PART C — KYC setup =============================
-- 1) Per-user verification flag, denormalised for plan gating.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kyc_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_kyc_status_check
  CHECK (kyc_status IN ('none', 'submitted', 'verified', 'rejected'));

-- Grandfather existing active paid subscribers so they don't lose access.
UPDATE public.users
   SET kyc_status = 'verified'
 WHERE kyc_status = 'none'
   AND subscription_status = 'active'
   AND current_plan IS NOT NULL
   AND current_plan <> 'free';

-- 2) Submissions table.
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (subject_type IN ('individual', 'company')),
  personal JSONB,
  company JSONB,
  risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  documents JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'verified', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kyc_user ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON public.kyc_submissions(status);

-- 3) Row-Level Security: owner + admin only.
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_kyc" ON public.kyc_submissions;
CREATE POLICY "own_kyc" ON public.kyc_submissions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_kyc_read" ON public.kyc_submissions;
CREATE POLICY "admin_kyc_read" ON public.kyc_submissions FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admin_kyc_update" ON public.kyc_submissions;
CREATE POLICY "admin_kyc_update" ON public.kyc_submissions FOR UPDATE USING (is_admin());

-- 4) Private storage bucket for documents.
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "kyc_owner_read" ON storage.objects;
CREATE POLICY "kyc_owner_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin()
    )
  );

DROP POLICY IF EXISTS "kyc_owner_insert" ON storage.objects;
CREATE POLICY "kyc_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_owner_update" ON storage.objects;
CREATE POLICY "kyc_owner_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'kyc-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_owner_delete" ON storage.objects;
CREATE POLICY "kyc_owner_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kyc-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin()
    )
  );

-- =============================================================================
-- DONE. Ab app mein logout → login karein (admin role refresh ke liye).
-- =============================================================================
