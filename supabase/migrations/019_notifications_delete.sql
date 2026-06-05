-- 019_notifications_delete.sql — allow a user to delete (swipe-dismiss) their
-- own notifications.

DROP POLICY IF EXISTS "own_notifications_delete" ON notifications;
CREATE POLICY "own_notifications_delete" ON notifications FOR DELETE
  USING (user_id = auth.uid());
