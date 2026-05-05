-- ============================================================================
-- Allow status='VOIDED' on installments
-- ============================================================================
-- voidSale() needs to mark installments as VOIDED when their parent sale is
-- annulled, so they stop appearing in collections / overdue reports without
-- losing the row (we keep it for audit history).
--
-- The original CHECK constraint only allowed PENDING/PARTIAL/PAID/OVERDUE.
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.installments
  DROP CONSTRAINT IF EXISTS installments_status_check;

ALTER TABLE public.installments
  ADD CONSTRAINT installments_status_check
  CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'VOIDED'));
