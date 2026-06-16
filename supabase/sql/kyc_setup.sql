-- =============================================================================
-- KYC (identity verification) setup — AML/UAF manual-review flow.
--
-- Mirrors the payment-receipt review pattern but stores documents in a PRIVATE
-- storage bucket (never public): only the owner and admins can read them, and
-- the admin views them through short-lived signed URLs.
--
-- Idempotent — safe to run multiple times. Run in the Supabase SQL editor (or
-- include after 001_full_setup.sql).
-- =============================================================================

-- 1) Per-user verification flag, denormalised for plan gating. -----------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kyc_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_kyc_status_check
  CHECK (kyc_status IN ('none', 'submitted', 'verified', 'rejected'));

-- Grandfather existing active paid subscribers so they don't lose access when
-- the gate switches on (KYC is required for NEW paid subscriptions onward).
UPDATE public.users
   SET kyc_status = 'verified'
 WHERE kyc_status = 'none'
   AND subscription_status = 'active'
   AND current_plan IS NOT NULL
   AND current_plan <> 'free';

-- 2) Submissions table. --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (subject_type IN ('individual', 'company')),
  personal JSONB,
  company JSONB,
  risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Map of documentKey -> private storage path (NOT a public URL).
  documents JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'verified', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kyc_user ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON public.kyc_submissions(status);

-- 3) Row-Level Security: owner + admin only. -----------------------------------
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_kyc" ON public.kyc_submissions;
CREATE POLICY "own_kyc" ON public.kyc_submissions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_kyc_read" ON public.kyc_submissions;
CREATE POLICY "admin_kyc_read" ON public.kyc_submissions FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admin_kyc_update" ON public.kyc_submissions;
CREATE POLICY "admin_kyc_update" ON public.kyc_submissions FOR UPDATE USING (is_admin());

-- 4) Private storage bucket for documents. -------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Objects are laid out as {userId}/{submissionId}/{docKey}.{ext}; the first
-- path segment is the owner's uid. Owner manages their own folder; admins read
-- everything. No public/anon access at all.
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

-- NOTE: the LAFISE Poket webhook (Edge Function) that auto-activates card
-- payments should also require kyc_status = 'verified' before flipping
-- subscription_status to 'active' — the app's client gate already withholds
-- paid capabilities until KYC is verified, but enforcing it server-side keeps
-- the two paths consistent.
