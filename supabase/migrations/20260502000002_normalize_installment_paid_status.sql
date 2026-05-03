-- ============================================================================
-- Mark fully-paid installments as PAID
-- ============================================================================
-- Some installments have paid_amount >= amount but status is still PARTIAL or
-- OVERDUE because nothing flipped them to PAID. The debt page rendered those
-- as "vencido" (e.g. Sandra Valeria Ruiz showed "1 venc" with no real debt).
--
-- This is a one-shot data fix. The application code (actions/payments.ts and
-- the credit-plans view) already treats balance == 0 as fully paid, but
-- normalizing the stored status keeps reports / queries that rely on status
-- truthful too.
-- ============================================================================

SET search_path = public, pg_temp;

UPDATE public.installments
SET status = 'PAID'
WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')
  AND COALESCE(paid_amount, 0) >= amount - 0.009;
