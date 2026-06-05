-- RutaRentable — combined Stage 2 setup. Paste ALL of this into Supabase SQL Editor and Run.

-- ============================================================
-- 001_initial_schema.sql
-- ============================================================
-- Vehicle catalog (seeded from client Excel)
CREATE TABLE vehicle_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_type TEXT NOT NULL CHECK (unit_type IN ('car', 'motorcycle')),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT,
  fuel_type TEXT NOT NULL CHECK (fuel_type IN ('gasoline', 'diesel', 'electric')),
  engine_cc INTEGER,
  transmission TEXT,
  est_km_per_liter NUMERIC(6,2),
  recommended_use TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  currency TEXT NOT NULL DEFAULT 'NIO' CHECK (currency IN ('NIO', 'USD')),
  fuel_unit TEXT NOT NULL DEFAULT 'liter' CHECK (fuel_unit IN ('liter', 'gallon')),
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'overdue', 'cancelled')),
  current_plan TEXT DEFAULT 'free',
  free_calculations_used INTEGER DEFAULT 0,
  registered_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('car', 'motorcycle')),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  real_km_per_liter NUMERIC(6,2),
  vehicle_value NUMERIC(12,2),
  useful_life_km INTEGER,
  maintenance_per_km NUMERIC(8,4),
  tires_per_km NUMERIC(8,4),
  oil_cost NUMERIC(10,2),
  oil_freq_km INTEGER,
  monthly_fixed_costs NUMERIC(10,2),
  monthly_km INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES user_vehicles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  platform TEXT NOT NULL CHECK (platform IN ('indrive', 'uber', 'taxi', 'private', 'delivery', 'other')),
  km_with_passenger NUMERIC(8,2) NOT NULL,
  dead_km NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_km NUMERIC(8,2) NOT NULL,
  fare_charged NUMERIC(10,2) NOT NULL,
  commission_pct NUMERIC(5,2) NOT NULL,
  fuel_cost NUMERIC(10,2),
  tires_cost NUMERIC(10,2),
  oil_cost NUMERIC(10,2),
  maintenance_cost NUMERIC(10,2),
  depreciation_cost NUMERIC(10,2),
  fixed_costs NUMERIC(10,2),
  commission_amount NUMERIC(10,2),
  total_trip_cost NUMERIC(10,2),
  net_profit NUMERIC(10,2),
  margin NUMERIC(6,4),
  status TEXT CHECK (status IN ('profitable', 'acceptable', 'not_profitable')),
  notes TEXT
);

CREATE TABLE parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'user')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scope, user_id, key)
);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_nio NUMERIC(10,2),
  price_usd NUMERIC(10,2),
  calc_limit INTEGER,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'overdue', 'cancelled', 'trial')),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NIO',
  method TEXT,
  status TEXT DEFAULT 'confirmed',
  receipt_url TEXT,
  paid_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 002_rls_policies.sql
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data" ON users FOR ALL USING (id = auth.uid());
CREATE POLICY "own_vehicles" ON user_vehicles FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_trips" ON trips FOR ALL USING (user_id = auth.uid());
CREATE POLICY "catalog_public" ON vehicle_catalog FOR SELECT USING (true);

-- ============================================================
-- 003_stage2.sql
-- ============================================================
-- 003_stage2.sql — Stage 2: accounts, sync columns, admin role, plans, params, announcements.

-- ---- Account & sync columns ----
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'driver'
  CHECK (role IN ('driver', 'admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE user_vehicles ADD COLUMN IF NOT EXISTS fuel_price_per_unit NUMERIC(10,2);
ALTER TABLE user_vehicles ADD COLUMN IF NOT EXISTS tire_life_km INTEGER;

ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ---- Payments method/currency (align with app PaymentMethod) ----
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method TEXT;

-- ---- Announcements ----
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target JSONB NOT NULL DEFAULT '{"kind":"all"}'::jsonb,
  send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Seed subscription plans ----
INSERT INTO plans (name, price_nio, price_usd, calc_limit, features, is_active) VALUES
  ('Gratis', 0, 0, 5, '["5 cálculos","Calculadora básica","Historial local"]'::jsonb, true),
  ('Básico', 120, 3.5, NULL, '["Cálculos ilimitados","Historial en la nube","Reportes"]'::jsonb, true),
  ('Pro', 250, 7, NULL, '["Todo lo de Básico","Múltiples vehículos","Punto de equilibrio"]'::jsonb, true),
  ('Cooperativa', 1500, 42, NULL, '["Facturación grupal","Reportes de flota","Hasta 20 conductores"]'::jsonb, true)
ON CONFLICT DO NOTHING;

-- ---- Seed global parameters (Nicaragua 2024) ----
INSERT INTO parameters (scope, user_id, key, value, unit) VALUES
  ('global', NULL, 'gasolinePerLiter', '45', 'C$/L'),
  ('global', NULL, 'dieselPerLiter', '38', 'C$/L'),
  ('global', NULL, 'profitableThreshold', '0.25', 'ratio'),
  ('global', NULL, 'acceptableThreshold', '0.10', 'ratio'),
  ('global', NULL, 'desiredMargin', '0.30', 'ratio')
ON CONFLICT (scope, user_id, key) DO NOTHING;

-- ============================================================
-- 004_admin.sql
-- ============================================================
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

-- ============================================================
-- 005_user_signup.sql
-- ============================================================
-- 005_user_signup.sql — auto-provision a public.users row on auth signup,
-- and provide the admin-promotion command.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, email, registered_at, updated_at,
    role, subscription_status, current_plan, free_calculations_used
  )
  VALUES (
    new.id, new.email, now(), now(),
    'driver', 'trial', 'free', 0
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- After the admin signs in once, promote them (replace the email):
--   UPDATE public.users SET role = 'admin' WHERE email = 'admin@rutarentable.com';
