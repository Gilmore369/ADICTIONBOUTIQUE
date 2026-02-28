-- ============================================================================
-- CLOSE ALL OPEN SHIFTS
-- ============================================================================
-- This script closes all currently open cash shifts
-- Use this if you want to start fresh with new shifts for both stores
-- ============================================================================

-- Show current open shifts before closing
SELECT 
  'BEFORE CLOSING:' as status,
  id,
  store_id,
  user_id,
  opening_amount,
  opened_at,
  (SELECT email FROM auth.users WHERE id = cash_shifts.user_id) as user_email
FROM cash_shifts 
WHERE status = 'OPEN'
ORDER BY opened_at DESC;

-- Close all open shifts
UPDATE cash_shifts 
SET 
  status = 'CLOSED',
  closed_at = NOW(),
  closing_amount = opening_amount,
  expected_amount = opening_amount,
  difference = 0
WHERE status = 'OPEN';

-- Show result
SELECT 
  'AFTER CLOSING:' as status,
  id,
  store_id,
  user_id,
  opening_amount,
  closing_amount,
  closed_at,
  (SELECT email FROM auth.users WHERE id = cash_shifts.user_id) as user_email
FROM cash_shifts 
WHERE closed_at > NOW() - INTERVAL '1 minute'
ORDER BY closed_at DESC;

-- Verify no open shifts remain
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ SUCCESS: No open shifts remaining. You can now open new shifts for both stores.'
    ELSE '✗ WARNING: ' || COUNT(*) || ' open shifts still exist'
  END as result
FROM cash_shifts 
WHERE status = 'OPEN';
