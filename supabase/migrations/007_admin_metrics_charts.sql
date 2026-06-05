-- 007_admin_metrics_charts.sql — fill the dashboard's 12-month trend charts
-- (revenueByMonth + userGrowth) that were stubbed empty in 004.

CREATE OR REPLACE FUNCTION admin_metrics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  rev jsonb;
  growth jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Revenue per month (last 12 months of confirmed payments).
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object('month', to_char(s.m, 'Mon'), 'revenue', s.r)
           ORDER BY s.m
         ), '[]'::jsonb)
  INTO rev
  FROM (
    SELECT g.m AS m,
           COALESCE((
             SELECT sum(p.amount) FROM payments p
             WHERE p.status = 'confirmed'
               AND date_trunc('month', p.paid_at) = g.m
           ), 0) AS r
    FROM generate_series(
           date_trunc('month', now()) - interval '11 months',
           date_trunc('month', now()),
           interval '1 month'
         ) AS g(m)
  ) s;

  -- Cumulative user growth (drivers registered up to each month).
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object('month', to_char(s.m, 'Mon'), 'users', s.u)
           ORDER BY s.m
         ), '[]'::jsonb)
  INTO growth
  FROM (
    SELECT g.m AS m,
           (SELECT count(*) FROM users
            WHERE role <> 'admin'
              AND date_trunc('month', registered_at) <= g.m) AS u
    FROM generate_series(
           date_trunc('month', now()) - interval '11 months',
           date_trunc('month', now()),
           interval '1 month'
         ) AS g(m)
  ) s;

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
    'revenueByMonth', rev,
    'userGrowth', growth
  ) INTO result;

  RETURN result;
END;
$$;
