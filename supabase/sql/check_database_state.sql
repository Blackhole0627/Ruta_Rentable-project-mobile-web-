-- Quick health check after setup (run in Supabase SQL Editor).
-- Copy the results if you need help debugging.

-- 1) plans.id must be TEXT with slugs free/basic/pro/coop for this app
select
  c.data_type as plans_id_type,
  case
    when c.data_type = 'text' then 'OK — matches app'
    else 'PROBLEM — app expects TEXT ids (free, basic, pro, coop), not ' || c.data_type
  end as verdict
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'plans' and c.column_name = 'id';

-- 2) Current plans
select id, name, capabilities, duration_days, is_active
from public.plans
order by price_nio nulls last;

-- 3) Required tables present?
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users', 'plans', 'payments', 'user_vehicles', 'trips',
    'vehicle_catalog', 'parameters', 'announcements', 'notifications'
  )
order by 1;

-- 4) Admin users (need role = admin for catalog/plan writes)
select id, email, role, current_plan, subscription_status
from public.users
where role = 'admin' or email is not null
order by role desc, email
limit 20;
