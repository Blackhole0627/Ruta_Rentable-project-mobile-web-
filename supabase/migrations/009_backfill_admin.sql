-- 009_backfill_admin.sql — fix "admin panel shows 0 users".
-- Ensures every auth user has a public.users row, and promotes the admin so
-- is_admin() (used by admin_list_users / admin_metrics) returns true.

-- 1) Backfill any auth.users that have no public.users row (e.g. accounts
--    created before the handle_new_user trigger existed).
INSERT INTO public.users (
  id, email, registered_at, updated_at, role,
  subscription_status, current_plan, free_calculations_used
)
SELECT u.id, u.email, COALESCE(u.created_at, now()), now(), 'driver', 'trial', 'free', 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

-- 2) Promote your admin account (CHANGE the email if different).
UPDATE public.users SET role = 'admin' WHERE email = 'hassaankhalid@gmail.com';

-- 3) Verify:
--    SELECT email, role FROM public.users ORDER BY role;
