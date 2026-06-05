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
