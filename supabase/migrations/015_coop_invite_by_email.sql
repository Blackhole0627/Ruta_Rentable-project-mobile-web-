-- 015_coop_invite_by_email.sql — let a driver SEE and RESPOND to cooperative
-- invitations addressed to their email, even if coop_members.user_id doesn't
-- match their auth id (which can happen after project migrations). Fixes the
-- "invited driver still sees the create screen" bug.

DROP POLICY IF EXISTS "coop_members_admin" ON coop_members;
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
