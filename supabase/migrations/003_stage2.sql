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
