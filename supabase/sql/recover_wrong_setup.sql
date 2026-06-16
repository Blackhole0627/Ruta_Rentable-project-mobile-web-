-- =============================================================================
-- Recovery: accidentally ran 001_full_setup.sql on the WRONG Supabase project
-- =============================================================================
--
-- READ FIRST — pick your situation:
--
-- A) Project was NEW / EMPTY (no real users yet)
--    → Usually fine. Re-run only the parts that failed, or create a fresh
--      Supabase project and run 001_full_setup.sql once there (recommended).
--
-- B) Project had REAL client data (users, trips, payments)
--    → Do NOT run this whole file blindly.
--    → Supabase Dashboard → Database → Backups → restore if available.
--    → Or create a NEW Supabase project, run 001 there, point apps/web/.env
--      to the new URL + anon key.
--
-- C) plans.id is UUID (old schema) — app will NOT work correctly
--    → Best fix: new empty project + 001_full_setup.sql once.
--    → This app stores current_plan as text slugs: 'free', 'basic', 'pro', 'coop'.
--
-- =============================================================================
-- Step 1: Diagnose (always safe to run)
-- =============================================================================

select 'plans.id type' as check, data_type as value
from information_schema.columns
where table_schema = 'public' and table_name = 'plans' and column_name = 'id';

select 'plan rows' as check, count(*)::text as value from public.plans;
select id, name from public.plans order by name;

-- =============================================================================
-- Step 2: If plans.id is TEXT but capabilities empty — safe patch
-- =============================================================================
-- Run: supabase/sql/plan_capabilities.sql (updates by name, not id slug)

-- =============================================================================
-- Step 3: Ensure YOUR admin email has DB role (replace email)
-- =============================================================================
-- update public.users set role = 'admin' where email = 'YOUR_ADMIN@EMAIL.COM';

-- =============================================================================
-- Step 4: If 001 failed halfway with "already exists" errors
-- =============================================================================
-- That is normal on a partially-set-up DB. Run check_database_state.sql and
-- fix only what is missing — do not re-run the full 001 on production data.
