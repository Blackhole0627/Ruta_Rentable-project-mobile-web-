-- 013_notifications.sql — in-app notifications (coop invites, announcements, system).

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

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- A user reads & updates (mark-read) their own notifications.
DROP POLICY IF EXISTS "own_notifications_read" ON notifications;
CREATE POLICY "own_notifications_read" ON notifications FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "own_notifications_update" ON notifications;
CREATE POLICY "own_notifications_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Any authenticated user can create a notification for another user
-- (e.g. a cooperative admin inviting a driver). Admins too.
DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications" ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
