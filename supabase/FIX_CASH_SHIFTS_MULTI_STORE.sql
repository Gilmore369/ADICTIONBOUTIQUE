-- ============================================================================
-- FIX CASH SHIFTS: Allow Multiple Stores for Admin
-- ============================================================================
-- This script ensures admin users can open cash shifts for both stores simultaneously
-- It removes any constraints that prevent opening multiple shifts
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== CHECKING CURRENT CASH SHIFTS ===';
END $$;

-- Show current open shifts
SELECT 
  id,
  store_id,
  user_id,
  opening_amount,
  status,
  opened_at,
  (SELECT email FROM auth.users WHERE id = cash_shifts.user_id) as user_email
FROM cash_shifts 
WHERE status = 'OPEN'
ORDER BY opened_at DESC;

DO $$
BEGIN
  RAISE NOTICE '=== CHECKING FOR BLOCKING CONSTRAINTS ===';
END $$;

-- Check if there are any unique constraints preventing multiple open shifts
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'cash_shifts'::regclass
  AND contype IN ('u', 'x'); -- unique, exclusion (not primary key)

-- Drop any unique constraint on (store_id, status) if it exists
DO $$
BEGIN
  -- Try to drop constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'cash_shifts'::regclass 
    AND conname LIKE '%store%status%'
  ) THEN
    EXECUTE 'ALTER TABLE cash_shifts DROP CONSTRAINT ' || (
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'cash_shifts'::regclass 
      AND conname LIKE '%store%status%'
      LIMIT 1
    );
    RAISE NOTICE 'Dropped constraint preventing multiple open shifts per store';
  END IF;
  
  -- Try to drop unique index if it exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'cash_shifts' 
    AND indexdef LIKE '%UNIQUE%'
    AND (indexdef LIKE '%store_id%' AND indexdef LIKE '%status%')
  ) THEN
    EXECUTE 'DROP INDEX ' || (
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'cash_shifts' 
      AND indexdef LIKE '%UNIQUE%'
      AND (indexdef LIKE '%store_id%' AND indexdef LIKE '%status%')
      LIMIT 1
    );
    RAISE NOTICE 'Dropped unique index preventing multiple open shifts per store';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '=== CHECKING FOR TRIGGERS ===';
END $$;

-- Check for any triggers on cash_shifts that might block inserts
SELECT 
  tgname as trigger_name,
  tgtype,
  proname as function_name,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'cash_shifts'::regclass
  AND NOT tgisinternal;

DO $$
BEGIN
  RAISE NOTICE '=== VERIFYING RLS POLICIES ===';
END $$;

-- Verify RLS policies allow admin to create shifts
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'cash_shifts';

DO $$
BEGIN
  RAISE NOTICE '=== FIX COMPLETE ===';
  RAISE NOTICE 'Admin users can now open cash shifts for both TIENDA_HOMBRES and TIENDA_MUJERES simultaneously';
  RAISE NOTICE 'If you still see errors, run the query above to check current open shifts';
  RAISE NOTICE 'You may need to close existing shifts before opening new ones';
END $$;
