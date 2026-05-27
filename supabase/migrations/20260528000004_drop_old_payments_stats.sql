-- ============================================================
-- Drop the OLD 3-arg get_payments_stats to remove ambiguity.
-- After the 4-arg version was added (migration 20260528000002),
-- PostgreSQL has both versions and supabase-js may pick the wrong one.
-- Only keep the new 4-arg version.
-- ============================================================

DROP FUNCTION IF EXISTS get_payments_stats(DATE, DATE, TEXT);
-- The 4-arg version (with p_store_id) stays
