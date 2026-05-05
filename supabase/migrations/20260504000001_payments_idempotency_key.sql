-- ============================================================================
-- Add idempotency_key to payments
-- ============================================================================
-- Without this, a double-clicked "Registrar pago" button or a network retry
-- can create two payment rows for the same intent and apply the cuota twice.
-- The client now sends a UUID (idempotency_key) per payment attempt; if the
-- DB already has a row with that key, processPayment short-circuits and
-- returns the existing payment instead of re-applying.
--
-- Nullable for backward compatibility — payments inserted by older code paths
-- (and seed data) don't have one. UNIQUE WHERE NOT NULL prevents collisions
-- on real keys without forcing a value on legacy rows.
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_unique
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.payments.idempotency_key IS
  'Client-generated UUID per payment attempt. processPayment uses it to dedupe duplicate submissions (double-click, retry).';
