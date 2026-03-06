-- Migration: Add rating E + blacklist system
-- Date: 2026-03-06
-- Description:
--   1. Add 'E' category to client rating (lowest tier, new/unknown clients)
--   2. Add blacklist fields to clients table
--   3. Function to auto-blacklist clients with 10+ days overdue
--   4. Function to get automatic credit limit based on rating
--   5. Trigger to auto-update credit_limit when rating changes

-- ─── 1. Extend rating to include 'E' ─────────────────────────────────────────

-- Drop old check constraint
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_rating_check;

-- Add new constraint including 'E'
ALTER TABLE clients ADD CONSTRAINT clients_rating_check
  CHECK (rating IN ('A', 'B', 'C', 'D', 'E'));

-- Add 'E' to the rating_category enum used in client_ratings table
-- (PostgreSQL doesn't allow removing from enum, only adding)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'E'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'rating_category')
  ) THEN
    ALTER TYPE rating_category ADD VALUE 'E';
  END IF;
END $$;

-- Update comment to reflect new scale
COMMENT ON COLUMN clients.rating IS
  'Client rating: A=Excelente (2000+ S/), B=Bueno (1001-2000 S/), C=Regular (751-1000 S/), D=Básico (501-750 S/), E=Nuevo/Riesgo (100-500 S/)';

-- ─── 2. Blacklist fields ──────────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS blacklisted        BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklisted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklisted_reason TEXT         DEFAULT 'DEUDA_VENCIDA';

-- Index for fast lookup of blacklisted clients
CREATE INDEX IF NOT EXISTS idx_clients_blacklisted ON clients(blacklisted)
  WHERE blacklisted = true;

COMMENT ON COLUMN clients.blacklisted        IS 'True if client has been automatically blacklisted due to overdue debt';
COMMENT ON COLUMN clients.blacklisted_at     IS 'Timestamp when client was added to blacklist';
COMMENT ON COLUMN clients.blacklisted_reason IS 'Reason for blacklisting (default: DEUDA_VENCIDA = debt > 10 days overdue)';

-- ─── 3. Function: auto-blacklist clients overdue > 10 days ───────────────────

CREATE OR REPLACE FUNCTION auto_blacklist_overdue_clients()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Add to blacklist: clients with any installment overdue > 10 days and not yet blacklisted
  UPDATE clients
  SET
    blacklisted        = true,
    blacklisted_at     = NOW(),
    blacklisted_reason = 'DEUDA_VENCIDA'
  WHERE id IN (
    SELECT DISTINCT cp.client_id
    FROM installments i
    JOIN credit_plans cp ON i.plan_id = cp.id
    WHERE i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
      AND i.due_date < NOW() - INTERVAL '10 days'
  )
  AND (blacklisted = false OR blacklisted IS NULL);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION auto_blacklist_overdue_clients() IS
  'Auto-blacklists clients with installments overdue more than 10 days. Returns count of newly blacklisted clients.';

-- ─── 4. Function: remove blacklist when no more overdue debt > 10 days ───────

CREATE OR REPLACE FUNCTION remove_blacklist_if_cleared(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_overdue BOOLEAN;
BEGIN
  -- Check if client still has installments overdue > 10 days
  SELECT EXISTS (
    SELECT 1
    FROM installments i
    JOIN credit_plans cp ON i.plan_id = cp.id
    WHERE cp.client_id = p_client_id
      AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
      AND i.due_date < NOW() - INTERVAL '10 days'
  ) INTO v_has_overdue;

  -- If no overdue debt, remove from blacklist
  IF NOT v_has_overdue THEN
    UPDATE clients
    SET
      blacklisted        = false,
      blacklisted_at     = NULL,
      blacklisted_reason = NULL
    WHERE id = p_client_id
      AND blacklisted = true;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION remove_blacklist_if_cleared(UUID) IS
  'Removes client from blacklist if they no longer have installments overdue > 10 days. Returns true if removed.';

-- ─── 5. Function: automatic credit limit per rating ──────────────────────────

CREATE OR REPLACE FUNCTION get_credit_limit_for_rating(p_rating TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_rating
    WHEN 'A' THEN 2500.00   -- Range: 2000+  → midpoint/default 2500
    WHEN 'B' THEN 1500.00   -- Range: 1001-2000 → midpoint 1500
    WHEN 'C' THEN  875.00   -- Range: 751-1000  → midpoint 875
    WHEN 'D' THEN  625.00   -- Range: 501-750   → midpoint 625
    ELSE           300.00   -- 'E'  Range: 100-500   → midpoint 300
  END;
END;
$$;

COMMENT ON FUNCTION get_credit_limit_for_rating(TEXT) IS
  'Returns the default credit limit (midpoint of range) for a given rating: A=2500, B=1500, C=875, D=625, E=300';

-- ─── 6. Trigger: auto-update credit_limit when rating changes ────────────────

CREATE OR REPLACE FUNCTION update_credit_limit_on_rating_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only fire when rating actually changes and is not null
  IF NEW.rating IS DISTINCT FROM OLD.rating AND NEW.rating IS NOT NULL THEN
    NEW.credit_limit := get_credit_limit_for_rating(NEW.rating);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_credit_limit_on_rating ON clients;
CREATE TRIGGER trg_update_credit_limit_on_rating
  BEFORE UPDATE OF rating ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_limit_on_rating_change();

COMMENT ON TRIGGER trg_update_credit_limit_on_rating ON clients IS
  'Automatically updates credit_limit to the midpoint of the rating range when rating changes. Can be overridden manually afterward.';

-- ─── 7. Set initial rating E for existing clients without rating ──────────────

UPDATE clients
SET
  rating       = 'E',
  credit_limit = CASE WHEN credit_limit = 0 THEN 300.00 ELSE credit_limit END
WHERE rating IS NULL;
