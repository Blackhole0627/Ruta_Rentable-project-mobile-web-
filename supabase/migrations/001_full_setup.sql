-- =============================================================================
-- RutaRentable — COMPLETE Supabase setup (single migration)
-- =============================================================================
-- Run ONCE in Supabase Dashboard → SQL Editor on a NEW empty project.
--
-- AFTER this SQL succeeds, complete client setup:
--   1. Authentication → Email: enable Confirm email + OTP templates (see docs/EMAIL_SETUP.md)
--   2. Authentication → Providers → Google (optional, for Google sign-in)
--   3. Deploy Edge Functions: delete-account, send-welcome, calculate-trip,
--      poket-create-link, poket-webhook (see docs/POKET_INTEGRATION.md)
--   4. apps/web/.env:
--        VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ADMIN_EMAILS=client@email.com
--   5. Client admin signs up once in the app, then run:
--        UPDATE public.users SET role = 'admin' WHERE email = 'client@email.com';
--      (Both DB role AND VITE_ADMIN_EMAILS must match for the admin panel.)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;



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
  platform TEXT NOT NULL CHECK (platform IN ('indrive', 'aventon', 'uber', 'taxi', 'private', 'delivery', 'other')),
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
  id TEXT PRIMARY KEY,
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
  plan_id TEXT REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'overdue', 'cancelled', 'trial')),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NIO',
  method TEXT,
  status TEXT DEFAULT 'confirmed',
  receipt_url TEXT,
  paid_at TIMESTAMPTZ DEFAULT now()
);


ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE user_vehicles ADD COLUMN IF NOT EXISTS fuel_price_per_unit NUMERIC(10,2);
ALTER TABLE user_vehicles ADD COLUMN IF NOT EXISTS tire_life_km INTEGER;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE plans ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target JSONB NOT NULL DEFAULT '{"kind":"all"}'::jsonb,
  send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_link_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_payment_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_url TEXT;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('confirmed', 'pending', 'rejected'));
CREATE UNIQUE INDEX IF NOT EXISTS payments_external_link_id_key ON public.payments (external_link_id) WHERE external_link_id IS NOT NULL;

-- Cooperatives / fleets
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

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'system' CHECK (kind IN ('invite', 'announcement', 'system')),
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION is_coop_admin(coop UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM cooperatives c WHERE c.id = coop AND c.admin_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, name, registered_at, updated_at, role, subscription_status, current_plan, free_calculations_used)
  VALUES (
    new.id, new.email,
    COALESCE(NULLIF(new.raw_user_meta_data ->> 'name', ''), NULLIF(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    now(), now(), 'driver', 'trial', 'free', 0
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = COALESCE(public.users.name, EXCLUDED.name);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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

-- 007_admin_metrics_charts.sql — fill the dashboard's 12-month trend charts
-- (revenueByMonth + userGrowth) that were stubbed empty in 004.

CREATE OR REPLACE FUNCTION admin_metrics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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


-- 014_find_user_by_email.sql — lets a cooperative admin check whether an email
-- belongs to a registered user WITHOUT exposing the users table (RLS hides other
-- users' rows). SECURITY DEFINER bypasses RLS but only returns the id.

CREATE OR REPLACE FUNCTION find_user_id_by_email(p_email TEXT)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

-- 016_my_pending_invites.sql — reliable pending-invite lookup for the logged-in
-- driver. SECURITY DEFINER bypasses RLS entirely and matches by auth id OR email,
-- so the "invited driver still sees the create screen" bug can't happen.

CREATE OR REPLACE FUNCTION my_pending_invites()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'member', jsonb_build_object(
      'id', m.id, 'coopId', m.coop_id, 'email', m.email,
      'userId', m.user_id, 'status', m.status, 'invitedAt', m.invited_at
    ),
    'coop', jsonb_build_object(
      'id', c.id, 'name', c.name, 'adminId', c.admin_id, 'createdAt', c.created_at
    )
  )), '[]'::jsonb)
  FROM coop_members m
  JOIN cooperatives c ON c.id = m.coop_id
  WHERE m.status = 'invited'
    AND (
      m.user_id = auth.uid()
      OR lower(COALESCE(m.email, '')) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    );
$$;


CREATE OR REPLACE FUNCTION my_cooperative()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec RECORD;
  sub_active boolean := false;
  dur int := 30;
BEGIN
  SELECT c.id, c.name, c.admin_id, c.created_at, c.fleet_params
    INTO rec
    FROM cooperatives c
   WHERE c.admin_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM coop_members m
         WHERE m.coop_id = c.id AND m.status = 'active'
           AND (m.user_id = auth.uid()
             OR lower(COALESCE(m.email, '')) = lower(COALESCE(auth.jwt() ->> 'email', '')))
      )
   ORDER BY (c.admin_id = auth.uid()) DESC
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM users u WHERE u.id = rec.admin_id AND u.current_plan = 'coop') THEN
    SELECT COALESCE(p.duration_days, 30) INTO dur FROM plans p WHERE p.id = 'coop';
    SELECT EXISTS (
      SELECT 1 FROM payments pay
       WHERE pay.user_id = rec.admin_id AND pay.status = 'confirmed'
         AND pay.paid_at > now() - make_interval(days => dur)
    ) INTO sub_active;
  END IF;
  RETURN jsonb_build_object(
    'id', rec.id, 'name', rec.name, 'adminId', rec.admin_id,
    'createdAt', rec.created_at, 'fleetParams', rec.fleet_params,
    'subscriptionActive', sub_active
  );
END;
$$;

CREATE OR REPLACE FUNCTION leave_cooperative(p_coop_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM coop_members m
   WHERE m.coop_id = p_coop_id
     AND (m.user_id = auth.uid()
       OR lower(COALESCE(m.email, '')) = lower(COALESCE(auth.jwt() ->> 'email', '')));
END;
$$;

CREATE OR REPLACE FUNCTION broadcast_announcement(p_title TEXT, p_body TEXT, p_target JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO notifications (id, user_id, title, body, kind, link, read, created_at)
  SELECT gen_random_uuid(), u.id, p_title, p_body, 'announcement', '/', false, now()
    FROM users u
   WHERE u.role <> 'admin'
     AND (p_target->>'kind' = 'all'
       OR (p_target->>'kind' = 'plan' AND COALESCE(u.current_plan, 'free') = p_target->>'plan')
       OR (p_target->>'kind' = 'status' AND u.subscription_status = p_target->>'status'));
END;
$$;

-- ---- Row Level Security ----
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooperatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE coop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data" ON users FOR ALL USING (id = auth.uid());
CREATE POLICY "admin_all_users" ON users FOR ALL USING (is_admin());

CREATE POLICY "own_vehicles" ON user_vehicles FOR ALL USING (user_id = auth.uid());
CREATE POLICY "admin_all_vehicles" ON user_vehicles FOR ALL USING (is_admin());

CREATE POLICY "own_trips" ON trips FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_all_trips" ON trips FOR ALL USING (is_admin());
CREATE POLICY "coop_admin_read_trips" ON trips FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM coop_members m
    JOIN cooperatives c ON c.id = m.coop_id
    WHERE c.admin_id = auth.uid() AND m.user_id = trips.user_id
  )
);

CREATE POLICY "admin_all_parameters" ON parameters FOR ALL USING (is_admin());

CREATE POLICY "catalog_public" ON vehicle_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_admin_write" ON vehicle_catalog;
CREATE POLICY "catalog_admin_insert" ON vehicle_catalog FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "catalog_admin_update" ON vehicle_catalog FOR UPDATE
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "catalog_admin_delete" ON vehicle_catalog FOR DELETE USING (is_admin());

CREATE POLICY "plans_public_read" ON plans FOR SELECT USING (true);
CREATE POLICY "plans_admin_write" ON plans FOR ALL USING (is_admin());

CREATE POLICY "own_subscriptions" ON subscriptions FOR ALL
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "announcements_read" ON announcements FOR SELECT USING (true);
CREATE POLICY "announcements_admin_write" ON announcements FOR ALL USING (is_admin());

CREATE POLICY "own_payments" ON payments FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_payments_read" ON payments FOR SELECT USING (is_admin());
CREATE POLICY "admin_payments_update" ON payments FOR UPDATE USING (is_admin());

CREATE POLICY "coop_admin_manage" ON cooperatives FOR ALL
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());
CREATE POLICY "coop_member_read" ON cooperatives FOR SELECT USING (
  admin_id = auth.uid()
  OR EXISTS (SELECT 1 FROM coop_members m WHERE m.coop_id = id AND m.user_id = auth.uid())
);
CREATE POLICY "coop_members_admin" ON coop_members FOR ALL
  USING (
    is_coop_admin(coop_id)
    OR user_id = auth.uid()
    OR lower(COALESCE(email, '')) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    is_coop_admin(coop_id)
    OR user_id = auth.uid()
    OR lower(COALESCE(email, '')) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY "own_notifications_read" ON notifications FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "own_notifications_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "insert_notifications" ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "own_notifications_delete" ON notifications FOR DELETE
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

INSERT INTO plans (id, name, price_nio, price_usd, calc_limit, features, capabilities, duration_days, is_active) VALUES
  ('free', 'Gratis', 0, 0, 5, '["5 cálculos","Calculadora básica","Historial local"]'::jsonb, '[]'::jsonb, 30, true),
  ('basic', 'Básico', 120, 3.5, NULL, '["Cálculos ilimitados","Historial en la nube","Reportes"]'::jsonb, '["unlimitedCalc","reports","cloudSync"]'::jsonb, 30, true),
  ('pro', 'Pro', 250, 7, NULL, '["Todo lo de Básico","Múltiples vehículos","Punto de equilibrio"]'::jsonb, '["unlimitedCalc","reports","cloudSync","multiVehicle","breakEven"]'::jsonb, 30, true),
  ('coop', 'Cooperativa', 1500, 42, NULL, '["Facturación grupal","Reportes de flota","Hasta 20 conductores"]'::jsonb, '["unlimitedCalc","reports","cloudSync","multiVehicle","breakEven","cooperative"]'::jsonb, 30, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price_nio = EXCLUDED.price_nio, price_usd = EXCLUDED.price_usd,
  calc_limit = EXCLUDED.calc_limit, features = EXCLUDED.features, capabilities = EXCLUDED.capabilities,
  duration_days = EXCLUDED.duration_days, is_active = EXCLUDED.is_active;

INSERT INTO parameters (scope, user_id, key, value, unit) VALUES
  ('global', NULL, 'gasolinePerLiter', '45', 'C$/L'),
  ('global', NULL, 'dieselPerLiter', '38', 'C$/L'),
  ('global', NULL, 'profitableThreshold', '0.25', 'ratio'),
  ('global', NULL, 'acceptableThreshold', '0.10', 'ratio'),
  ('global', NULL, 'desiredMargin', '0.30', 'ratio'),
  ('global', NULL, 'adminEmails', 'blackhole45808@gmail.com', NULL)
ON CONFLICT (scope, user_id, key) DO NOTHING;

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


INSERT INTO public.users (id, email, registered_at, updated_at, role, subscription_status, current_plan, free_calculations_used)
SELECT u.id, u.email, COALESCE(u.created_at, now()), now(), 'driver', 'trial', 'free', 0
FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

-- Promote allowlisted admin emails (matches VITE_ADMIN_EMAILS / parameters.adminEmails).
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
  IF user_email = '' OR auth.uid() IS NULL THEN RETURN; END IF;
  SELECT value INTO allowed FROM parameters
   WHERE scope = 'global' AND user_id IS NULL AND key = 'adminEmails';
  IF allowed IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(string_to_array(allowed, ',')) AS e(raw)
     WHERE lower(trim(raw)) = user_email
  ) THEN RETURN; END IF;
  INSERT INTO users (id, email, name, role, updated_at)
  VALUES (auth.uid(), user_email, split_part(user_email, '@', 1), 'admin', now())
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION admin_upsert_vehicle_catalog(p_entry jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO vehicle_catalog (id, unit_type, make, model, category, fuel_type, est_km_per_liter)
  VALUES (
    COALESCE((p_entry->>'id')::uuid, gen_random_uuid()),
    COALESCE(p_entry->>'unit_type', 'car'),
    p_entry->>'make',
    p_entry->>'model',
    NULLIF(p_entry->>'category', ''),
    COALESCE(p_entry->>'fuel_type', 'gasoline'),
    COALESCE((p_entry->>'est_km_per_liter')::numeric, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    unit_type = EXCLUDED.unit_type, make = EXCLUDED.make, model = EXCLUDED.model,
    category = EXCLUDED.category, fuel_type = EXCLUDED.fuel_type,
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
  IF NOT is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM vehicle_catalog WHERE id = p_id;
END;
$$;

-- ---- RPC permissions (required for supabase.rpc from the app) ----
GRANT EXECUTE ON FUNCTION promote_admin_if_allowed() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_upsert_vehicle_catalog(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_delete_vehicle_catalog(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_metrics() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_user_id_by_email(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION my_pending_invites() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION my_cooperative() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION leave_cooperative(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION broadcast_announcement(TEXT, TEXT, JSONB) TO authenticated, service_role;