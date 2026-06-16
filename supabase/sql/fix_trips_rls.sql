-- Fix trip inserts blocked by missing WITH CHECK on RLS (run on existing projects).

DROP POLICY IF EXISTS "own_trips" ON trips;
CREATE POLICY "own_trips" ON trips FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
