-- Fix: permitir cuotas anuladas por devolucion sin romper installments_amount_check.
--
-- El esquema original exige installments.amount > 0. Las devoluciones a credito
-- pueden cancelar por completo una cuota no pagada. Para conservar historial con
-- status VOIDED, la cuota debe poder quedar en amount = 0 solo en ese estado.

ALTER TABLE public.installments
  DROP CONSTRAINT IF EXISTS installments_amount_check;

ALTER TABLE public.installments
  ADD CONSTRAINT installments_amount_check
  CHECK (
    amount > 0
    OR (status = 'VOIDED' AND amount = 0)
  );
