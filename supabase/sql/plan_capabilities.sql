-- Plan capability flags (/admin → Planes).
--
-- Safe patch: updates by plan NAME (works whether plans.id is TEXT slug or UUID).
-- Run AFTER capabilities + duration_days columns exist.
--
-- On a NEW project use supabase/migrations/001_full_setup.sql instead — it seeds
-- everything. Use this file only to patch an existing database.

alter table public.plans add column if not exists capabilities jsonb not null default '[]'::jsonb;
alter table public.plans add column if not exists duration_days integer not null default 30;

-- Básico / Basic
update public.plans
set capabilities = '["unlimitedCalc","reports","cloudSync"]'::jsonb
where (capabilities is null or capabilities = '[]'::jsonb)
  and lower(trim(name)) in ('básico', 'basico', 'basic');

-- Pro
update public.plans
set capabilities = '["unlimitedCalc","reports","cloudSync","multiVehicle","breakEven"]'::jsonb
where (capabilities is null or capabilities = '[]'::jsonb)
  and lower(trim(name)) in ('pro');

-- Cooperativa
update public.plans
set capabilities = '["unlimitedCalc","reports","cloudSync","multiVehicle","breakEven","cooperative"]'::jsonb
where (capabilities is null or capabilities = '[]'::jsonb)
  and lower(trim(name)) in ('cooperativa', 'coop', 'cooperative');

-- Gratis / Free — intentionally empty capabilities (free tier limits apply in app)
