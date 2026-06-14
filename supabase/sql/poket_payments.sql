-- LAFISE Poket payment integration — schema additions for the `payments` table.
--
-- The repo doesn't use checked-in migrations; apply this once in the Supabase
-- SQL editor (or `supabase db execute`) for BOTH the QA and production projects.
-- All statements are idempotent so re-running is safe.

-- Provider that owns the row ('poket' for automatic card payments; NULL for the
-- legacy manual bank-transfer flow).
alter table public.payments add column if not exists provider text;

-- Poket PayLink id. This is what the webhook sends back as `external_link_id`,
-- so it's how we correlate a payment event to the right pending row/user/plan.
alter table public.payments add column if not exists external_link_id text;

-- Poket attempt id (`try_id`) once an attempt finishes.
alter table public.payments add column if not exists external_payment_id text;

-- Raw provider status (Created | Authorized | Failed | ...), kept for auditing.
alter table public.payments add column if not exists provider_status text;

-- Hosted Poket checkout URL the driver was redirected to.
alter table public.payments add column if not exists checkout_url text;

-- The webhook looks rows up by external_link_id — index it. It must also be
-- unique so a replayed/duplicate PayLink can never create two payment rows.
create unique index if not exists payments_external_link_id_key
  on public.payments (external_link_id)
  where external_link_id is not null;

-- NOTE on RLS: the poket-webhook Edge Function writes with the service-role key
-- (bypasses RLS), and poket-create-link inserts the pending row as the
-- authenticated user, so no new policies are required. The existing
-- "user_id = auth.uid()" insert policy on `payments` still applies.
