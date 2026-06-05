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
