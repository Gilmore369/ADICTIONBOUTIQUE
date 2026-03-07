-- Migration: Fix credit_limit constraint and trigger
-- Date: 2026-03-06
-- Problem: The trigger update_credit_limit_on_rating_change() was unconditionally
--   setting credit_limit = get_credit_limit_for_rating(rating), ignoring the
--   existing credit_used. The check_credit_limit constraint (credit_used <= credit_limit)
--   would then reject the update when credit_used already exceeded the new limit.
-- Fix:
--   1. Drop the strict check_credit_limit constraint (credit_used CAN exceed the
--      credit_limit in real business operations — e.g., after a rating downgrade).
--   2. Replace with a lenient constraint: credit_limit >= 0.
--   3. Fix the trigger to never reduce credit_limit below the current credit_used.

-- ─── 1. Drop overly strict check constraint ──────────────────────────────────
ALTER TABLE clients DROP CONSTRAINT IF EXISTS check_credit_limit;

-- Replace with a simple non-negative constraint
ALTER TABLE clients
  ADD CONSTRAINT check_credit_limit_nonneg
  CHECK (credit_limit >= 0 AND credit_used >= 0);

-- ─── 2. Fix trigger function: never set credit_limit below credit_used ────────
CREATE OR REPLACE FUNCTION update_credit_limit_on_rating_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rating_limit NUMERIC;
BEGIN
  -- Only fire when rating actually changes and is not null
  IF NEW.rating IS DISTINCT FROM OLD.rating AND NEW.rating IS NOT NULL THEN
    v_rating_limit := get_credit_limit_for_rating(NEW.rating);

    -- Never reduce credit_limit below the client's current credit_used
    -- (a client may already have used more credit than the new rating's default)
    NEW.credit_limit := GREATEST(v_rating_limit, COALESCE(NEW.credit_used, 0));
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_credit_limit_on_rating_change() IS
  'Auto-updates credit_limit when rating changes. Uses GREATEST(rating_limit, credit_used) to avoid going below current usage.';
