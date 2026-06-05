-- 017_my_cooperative.sql — reliable "which cooperative do I belong to" lookup.
-- SECURITY DEFINER bypasses RLS and matches the admin OR an active membership
-- by auth id OR email, so a joined member always sees their cooperative.

CREATE OR REPLACE FUNCTION my_cooperative()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT to_jsonb(t) FROM (
    SELECT c.id,
           c.name,
           c.admin_id    AS "adminId",
           c.created_at   AS "createdAt",
           c.fleet_params AS "fleetParams"
    FROM cooperatives c
    WHERE c.admin_id = auth.uid()
       OR EXISTS (
         SELECT 1 FROM coop_members m
         WHERE m.coop_id = c.id
           AND m.status = 'active'
           AND (
             m.user_id = auth.uid()
             OR lower(COALESCE(m.email, '')) = lower(COALESCE(auth.jwt() ->> 'email', ''))
           )
       )
    ORDER BY (c.admin_id = auth.uid()) DESC
    LIMIT 1
  ) t;
$$;
