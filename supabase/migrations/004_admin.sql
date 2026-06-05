-- 004_admin.sql — admin role helper, RLS for Stage-2 tables, and admin RPCs.

-- Returns true when the calling user has the admin role.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$;

-- Admins can read/manage every user's data (drivers keep their own-row policies).
DROP POLICY IF EXISTS "admin_all_users" ON users;
CREATE POLICY "admin_all_users" ON users FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "admin_all_vehicles" ON user_vehicles;
CREATE POLICY "admin_all_vehicles" ON user_vehicles FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "admin_all_trips" ON trips;
CREATE POLICY "admin_all_trips" ON trips FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "admin_all_parameters" ON parameters;
CREATE POLICY "admin_all_parameters" ON parameters FOR ALL USING (is_admin());

-- Plans / subscriptions / payments / announcements.
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_public_read" ON plans;
CREATE POLICY "plans_public_read" ON plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "plans_admin_write" ON plans;
CREATE POLICY "plans_admin_write" ON plans FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "own_subscriptions" ON subscriptions;
CREATE POLICY "own_subscriptions" ON subscriptions FOR ALL
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "own_payments" ON payments;
CREATE POLICY "own_payments" ON payments FOR ALL
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "announcements_read" ON announcements;
CREATE POLICY "announcements_read" ON announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "announcements_admin_write" ON announcements;
CREATE POLICY "announcements_admin_write" ON announcements FOR ALL USING (is_admin());

-- ---- Admin RPCs (return camelCase JSON matching the app DTOs) ----
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', u.id,
      'name', COALESCE(u.name, ''),
      'email', COALESCE(u.email, ''),
      'phone', u.phone,
      'currentPlan', COALESCE(u.current_plan, 'free'),
      'status', u.subscription_status,
      'lastActive', COALESCE(u.updated_at, u.registered_at),
      'tripsCount', (SELECT count(*) FROM trips t WHERE t.user_id = u.id),
      'revenue', COALESCE((SELECT sum(p.amount) FROM payments p
                           WHERE p.user_id = u.id AND p.status = 'confirmed'), 0),
      'registeredAt', u.registered_at
    ) AS row
    FROM users u
    WHERE u.role <> 'admin' AND is_admin()
    ORDER BY u.registered_at DESC
  ) s;
$$;

CREATE OR REPLACE FUNCTION admin_metrics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'activeUsers', (SELECT count(*) FROM users WHERE role <> 'admin' AND subscription_status = 'active'),
    'trialUsers', (SELECT count(*) FROM users WHERE role <> 'admin' AND subscription_status = 'trial'),
    'overdueAccounts', (SELECT count(*) FROM users WHERE role <> 'admin' AND subscription_status = 'overdue'),
    'newSignupsThisMonth', (SELECT count(*) FROM users
        WHERE role <> 'admin' AND date_trunc('month', registered_at) = date_trunc('month', now())),
    'monthlyRevenue', COALESCE((SELECT sum(amount) FROM payments
        WHERE status = 'confirmed' AND date_trunc('month', paid_at) = date_trunc('month', now())), 0),
    'churnRate', CASE WHEN (SELECT count(*) FROM users WHERE role <> 'admin') = 0 THEN 0
        ELSE (SELECT count(*)::numeric FROM users WHERE role <> 'admin' AND subscription_status = 'cancelled')
             / (SELECT count(*) FROM users WHERE role <> 'admin') END,
    'revenueByMonth', '[]'::jsonb,
    'userGrowth', '[]'::jsonb
  ) INTO result;

  RETURN result;
END;
$$;
