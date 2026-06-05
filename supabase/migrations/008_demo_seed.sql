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
