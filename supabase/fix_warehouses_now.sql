-- URGENT FIX: Rename Warehouses
-- Description: Diagnose and fix warehouse naming issue
-- Date: 2026-02-20
-- 
-- EXECUTE THIS SCRIPT IN SUPABASE SQL EDITOR NOW

-- ============================================================================
-- STEP 1: DIAGNOSE CURRENT STATE
-- ============================================================================

-- Check current warehouse names in stock
SELECT 'CURRENT STOCK WAREHOUSES:' as info;
SELECT DISTINCT warehouse_id, COUNT(*) as count 
FROM stock 
GROUP BY warehouse_id;

-- Check stock for problematic product
SELECT 'STOCK FOR PRODUCT a50e8400-e29b-41d4-a716-446655440001:' as info;
SELECT warehouse_id, product_id, quantity 
FROM stock 
WHERE product_id = 'a50e8400-e29b-41d4-a716-446655440001';

-- ============================================================================
-- STEP 2: FIX WAREHOUSE NAMES
-- ============================================================================

-- Update stock table
UPDATE stock 
SET warehouse_id = 'TIENDA_MUJERES' 
WHERE warehouse_id = 'TIENDA_PRINCIPAL';

UPDATE stock 
SET warehouse_id = 'TIENDA_HOMBRES' 
WHERE warehouse_id = 'TIENDA_SECUNDARIA';

-- Update movements table
UPDATE movements 
SET warehouse_id = 'TIENDA_MUJERES' 
WHERE warehouse_id = 'TIENDA_PRINCIPAL';

UPDATE movements 
SET warehouse_id = 'TIENDA_HOMBRES' 
WHERE warehouse_id = 'TIENDA_SECUNDARIA';

-- Update sales table
UPDATE sales 
SET store_id = 'TIENDA_MUJERES' 
WHERE store_id = 'TIENDA_PRINCIPAL';

UPDATE sales 
SET store_id = 'TIENDA_HOMBRES' 
WHERE store_id = 'TIENDA_SECUNDARIA';

-- ============================================================================
-- STEP 3: VERIFY CHANGES
-- ============================================================================

-- Check updated warehouse names
SELECT 'UPDATED STOCK WAREHOUSES:' as info;
SELECT DISTINCT warehouse_id, COUNT(*) as count 
FROM stock 
GROUP BY warehouse_id;

-- Verify stock for problematic product
SELECT 'UPDATED STOCK FOR PRODUCT a50e8400-e29b-41d4-a716-446655440001:' as info;
SELECT warehouse_id, product_id, quantity 
FROM stock 
WHERE product_id = 'a50e8400-e29b-41d4-a716-446655440001';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ WAREHOUSE NAMES UPDATED SUCCESSFULLY!' as result;
SELECT 'You can now complete sales in the POS system.' as next_step;
