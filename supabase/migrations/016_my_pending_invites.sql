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
