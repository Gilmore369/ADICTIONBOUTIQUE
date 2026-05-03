-- ============================================================================
-- Drop CHECK (expected_amount >= 0) on cash_shifts
-- ============================================================================
-- The constraint blocked legitimate close operations: when the sum of cash
-- expenses during a shift legitimately exceeds (opening + cash sales +
-- collections), the calculated expected_amount is negative — that's a real
-- business situation (the cashier had to cover expenses out of pocket or out
-- of the next shift's float), not bad data. The negative number IS the
-- diagnostic; clobbering it to NULL or aborting the close is worse.
--
-- Symptom that triggered this:
--   "new row for relation 'cash_shifts' violates check constraint
--    'cash_shifts_expected_amount_check'" — left a Tienda Mujeres shift
--   open since 2026-04-12 because closing kept failing.
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.cash_shifts
  DROP CONSTRAINT IF EXISTS cash_shifts_expected_amount_check;
