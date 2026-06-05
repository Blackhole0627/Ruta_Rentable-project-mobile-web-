-- 020_payment_review.sql — manual bank-transfer payment review flow.
-- Adds plan_id to payments, allows pending/rejected status, and sets RLS so a
-- driver submits their own receipt and an admin reviews all of them.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_id TEXT;

-- Allow the manual-review statuses (table was created with no CHECK, but be explicit).
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('confirmed', 'pending', 'rejected'));

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- A driver inserts and reads their own payments.
DROP POLICY IF EXISTS "own_payments" ON payments;
CREATE POLICY "own_payments" ON payments FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- An admin can read every payment and update its status (approve/reject).
DROP POLICY IF EXISTS "admin_payments_read" ON payments;
CREATE POLICY "admin_payments_read" ON payments FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "admin_payments_update" ON payments;
CREATE POLICY "admin_payments_update" ON payments FOR UPDATE
  USING (is_admin());
