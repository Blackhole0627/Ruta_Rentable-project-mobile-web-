-- RutaRentable — FULL setup for a NEW Supabase project (run once, top to bottom).
-- Includes schema, RLS, RPCs, trigger, seeds (plans/params/catalog) + demo data.
-- After this, create your admin account, then run the admin-promote snippet (see chat).

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

-- ============================================================
-- 006_cooperatives.sql
-- ============================================================
-- 006_cooperatives.sql — Stage 3: cooperatives / fleets (B2B).

CREATE TABLE IF NOT EXISTS cooperatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fleet_params JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coop_id UUID NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coop_members_coop ON coop_members(coop_id);
CREATE INDEX IF NOT EXISTS idx_coop_members_user ON coop_members(user_id);

ALTER TABLE cooperatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE coop_members ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller the admin of this cooperative?
CREATE OR REPLACE FUNCTION is_coop_admin(coop UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM cooperatives c WHERE c.id = coop AND c.admin_id = auth.uid());
$$;

-- Cooperatives: admin manages own; members can read theirs.
DROP POLICY IF EXISTS "coop_admin_manage" ON cooperatives;
CREATE POLICY "coop_admin_manage" ON cooperatives FOR ALL
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

DROP POLICY IF EXISTS "coop_member_read" ON cooperatives;
CREATE POLICY "coop_member_read" ON cooperatives FOR SELECT
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM coop_members m WHERE m.coop_id = id AND m.user_id = auth.uid())
  );

-- Members: coop admin manages; a user can see/update their own membership row.
DROP POLICY IF EXISTS "coop_members_admin" ON coop_members;
CREATE POLICY "coop_members_admin" ON coop_members FOR ALL
  USING (is_coop_admin(coop_id) OR user_id = auth.uid())
  WITH CHECK (is_coop_admin(coop_id) OR user_id = auth.uid());

-- A cooperative admin may read the trips of drivers in their fleet (fleet report).
DROP POLICY IF EXISTS "coop_admin_read_trips" ON trips;
CREATE POLICY "coop_admin_read_trips" ON trips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coop_members m
      JOIN cooperatives c ON c.id = m.coop_id
      WHERE c.admin_id = auth.uid() AND m.user_id = trips.user_id
    )
  );

-- ============================================================
-- 007_admin_metrics_charts.sql
-- ============================================================
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

-- ============================================================
-- 008_demo_seed.sql
-- ============================================================
-- 008_demo_seed.sql — OPTIONAL demo data so the admin panel isn't empty.
-- Creates demo driver auth accounts (password: demo123456), which the
-- handle_new_user trigger turns into public.users rows, then adds trips +
-- payments. Run once in the Supabase SQL Editor. Safe to skip in production.
--
-- Note: inserting into auth.users directly is a seeding shortcut. If your
-- Supabase version rejects it, create the users via Dashboard → Authentication
-- → Add user instead, then run only the trips/payments part below.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  uid uuid;
  i int;
  j int;
  names text[] := ARRAY['Juan Pérez','María López','Carlos Ramírez','Ana Martínez','Luis Gómez','Rosa Castro'];
  statuses text[] := ARRAY['active','active','trial','overdue','active','cancelled'];
  plans text[] := ARRAY['basic','pro','free','basic','pro','free'];
  platforms text[] := ARRAY['indrive','uber','taxi','delivery','private'];
  km numeric; dead numeric; total numeric; cost numeric; fare numeric;
  plat text; commpct numeric; commamt numeric; ttc numeric; net numeric; marg numeric; st text;
  created timestamptz;
BEGIN
  FOR i IN 1..6 LOOP
    -- Skip if this demo email already exists.
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo'||i||'@ejemplo.com') THEN
      CONTINUE;
    END IF;

    uid := gen_random_uuid();
    created := now() - ((150 - i*15) || ' days')::interval;

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'demo'||i||'@ejemplo.com', crypt('demo123456', gen_salt('bf')),
      now(), created, now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    );

    -- The trigger created public.users; fill in profile fields.
    UPDATE public.users
       SET name = names[i],
           subscription_status = statuses[i],
           current_plan = plans[i],
           registered_at = created,
           updated_at = now()
     WHERE id = uid;

    -- Trips (8..18 per driver).
    FOR j IN 1..(8 + i) LOOP
      km := 4 + floor(random()*20);
      dead := floor(random()*4);
      total := km + dead;
      cost := total * (9 + random()*3);
      fare := round(cost * (0.9 + random()*0.8));
      plat := platforms[1 + floor(random()*5)::int];
      commpct := CASE plat WHEN 'uber' THEN 25 WHEN 'indrive' THEN 10 WHEN 'delivery' THEN 20 ELSE 0 END;
      commamt := fare * commpct/100;
      ttc := cost + commamt;
      net := fare - ttc;
      marg := CASE WHEN fare > 0 THEN net/fare ELSE -1 END;
      st := CASE WHEN marg >= 0.25 THEN 'profitable' WHEN marg >= 0.10 THEN 'acceptable' ELSE 'not_profitable' END;

      INSERT INTO trips (
        user_id, created_at, platform, km_with_passenger, dead_km, total_km,
        fare_charged, commission_pct, fuel_cost, tires_cost, oil_cost,
        maintenance_cost, depreciation_cost, fixed_costs, commission_amount,
        total_trip_cost, net_profit, margin, status
      ) VALUES (
        uid, now() - (j || ' days')::interval, plat, km, dead, total,
        fare, commpct, cost*0.4, cost*0.05, cost*0.05,
        cost*0.12, cost*0.23, cost*0.15, commamt,
        ttc, net, marg, st
      );
    END LOOP;

    -- A confirmed payment for paid plans.
    IF plans[i] <> 'free' AND statuses[i] <> 'cancelled' THEN
      INSERT INTO payments (user_id, amount, currency, method, status, paid_at)
      VALUES (uid, CASE plans[i] WHEN 'pro' THEN 250 ELSE 120 END, 'NIO', 'transfer', 'confirmed', now() - (i || ' days')::interval);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 010_seed_catalog.sql
-- ============================================================
-- 010_seed_catalog.sql — seed the vehicle_catalog table (50 cars + 40 motorcycles)
-- so the Admin → Catalog page has data. Safe to run once.

INSERT INTO vehicle_catalog (unit_type, make, model, category, fuel_type, est_km_per_liter)
SELECT * FROM (VALUES
('car','Toyota','Corolla','sedan','gasoline',13.5),
('car','Toyota','Yaris','sedan','gasoline',15),
('car','Toyota','Hilux','pickup','diesel',11),
('car','Toyota','RAV4','suv','gasoline',12),
('car','Toyota','Fortuner','suv','diesel',10.5),
('car','Hyundai','Accent','sedan','gasoline',14),
('car','Hyundai','Elantra','sedan','gasoline',13.5),
('car','Hyundai','Tucson','suv','gasoline',11.5),
('car','Hyundai','Santa Fe','suv','gasoline',10),
('car','Kia','Rio','sedan','gasoline',14.5),
('car','Kia','Sportage','suv','gasoline',11),
('car','Kia','Sorento','suv','gasoline',10.5),
('car','Nissan','Sentra','sedan','gasoline',13),
('car','Nissan','Versa','sedan','gasoline',14),
('car','Nissan','Frontier','pickup','diesel',10),
('car','Nissan','X-Trail','suv','gasoline',11.5),
('car','Honda','Civic','sedan','gasoline',14),
('car','Honda','CR-V','suv','gasoline',12),
('car','Honda','Fit','hatchback','gasoline',15.5),
('car','Mazda','3','sedan','gasoline',13.5),
('car','Mazda','CX-5','suv','gasoline',12),
('car','Chevrolet','Spark','hatchback','gasoline',16),
('car','Chevrolet','Aveo','sedan','gasoline',14),
('car','Chevrolet','Sail','sedan','gasoline',14.5),
('car','Chevrolet','D-Max','pickup','diesel',10.5),
('car','Suzuki','Swift','hatchback','gasoline',16),
('car','Suzuki','Vitara','suv','gasoline',12.5),
('car','Suzuki','Jimny','suv','gasoline',13),
('car','Mitsubishi','Lancer','sedan','gasoline',13),
('car','Mitsubishi','Montero Sport','suv','diesel',10),
('car','Mitsubishi','Outlander','suv','gasoline',11),
('car','Ford','Fiesta','hatchback','gasoline',14.5),
('car','Ford','Focus','sedan','gasoline',13.5),
('car','Ford','Ranger','pickup','diesel',10),
('car','Ford','Escape','suv','gasoline',11.5),
('car','Volkswagen','Jetta','sedan','gasoline',13),
('car','Volkswagen','Gol','hatchback','gasoline',14),
('car','Volkswagen','Tiguan','suv','gasoline',11),
('car','Peugeot','208','hatchback','gasoline',15),
('car','Peugeot','301','sedan','gasoline',14),
('car','Renault','Logan','sedan','gasoline',14.5),
('car','Renault','Duster','suv','gasoline',12),
('car','Geely','CK','sedan','gasoline',14),
('car','Geely','Emgrand','sedan','gasoline',13.5),
('car','Chery','QQ','hatchback','gasoline',16.5),
('car','Chery','Tiggo 2','suv','gasoline',12),
('car','BYD','F3','sedan','gasoline',14),
('car','BYD','Yuan Plus','suv','electric',25),
('car','Isuzu','D-Max','pickup','diesel',10.5),
('car','Great Wall','Wingle 5','pickup','diesel',10),
('motorcycle','Honda','CB110',NULL,'gasoline',45),
('motorcycle','Honda','Wave 110',NULL,'gasoline',48),
('motorcycle','Honda','XR190',NULL,'gasoline',35),
('motorcycle','Honda','CB125F',NULL,'gasoline',42),
('motorcycle','Honda','CB190R',NULL,'gasoline',38),
('motorcycle','Yamaha','YBR125',NULL,'gasoline',40),
('motorcycle','Yamaha','FZ150',NULL,'gasoline',38),
('motorcycle','Yamaha','XTZ125',NULL,'gasoline',42),
('motorcycle','Yamaha','Crypton',NULL,'gasoline',50),
('motorcycle','Yamaha','Fazer 250',NULL,'gasoline',32),
('motorcycle','Suzuki','GN125',NULL,'gasoline',42),
('motorcycle','Suzuki','Gixxer 150',NULL,'gasoline',40),
('motorcycle','Suzuki','Burgman 125',NULL,'gasoline',38),
('motorcycle','Suzuki','DR200',NULL,'gasoline',35),
('motorcycle','Bajaj','Boxer 150',NULL,'gasoline',45),
('motorcycle','Bajaj','Pulsar 150',NULL,'gasoline',40),
('motorcycle','Bajaj','Pulsar 200',NULL,'gasoline',35),
('motorcycle','Bajaj','Discover 125',NULL,'gasoline',48),
('motorcycle','TVS','Apache 160',NULL,'gasoline',38),
('motorcycle','TVS','Star City',NULL,'gasoline',50),
('motorcycle','TVS','XL100',NULL,'gasoline',55),
('motorcycle','Kawasaki','Z125',NULL,'gasoline',40),
('motorcycle','Kawasaki','Ninja 250',NULL,'gasoline',30),
('motorcycle','Italika','FT150',NULL,'gasoline',42),
('motorcycle','Italika','DM200',NULL,'gasoline',35),
('motorcycle','Italika','RT110',NULL,'gasoline',48),
('motorcycle','Vento','Workman 150',NULL,'gasoline',40),
('motorcycle','Vento','Rocketman 250',NULL,'gasoline',32),
('motorcycle','Vento','Street Rod 150',NULL,'gasoline',38),
('motorcycle','Keeway','RKV200',NULL,'gasoline',35),
('motorcycle','Keeway','Superlight 150',NULL,'gasoline',40),
('motorcycle','Lifan','LF150',NULL,'gasoline',42),
('motorcycle','Lifan','KPR200',NULL,'gasoline',35),
('motorcycle','Zongshen','ZS150',NULL,'gasoline',42),
('motorcycle','Zongshen','ZS200',NULL,'gasoline',38),
('motorcycle','Hero','Hunk 150',NULL,'gasoline',42),
('motorcycle','Hero','Splendor',NULL,'gasoline',50),
('motorcycle','AKT','TTR200',NULL,'gasoline',35),
('motorcycle','AKT','Special 110',NULL,'gasoline',48),
('motorcycle','UM','Renegade 200',NULL,'gasoline',35)
) AS v(unit_type, make, model, category, fuel_type, est_km_per_liter)
WHERE NOT EXISTS (SELECT 1 FROM vehicle_catalog x WHERE x.make = v.make AND x.model = v.model);
