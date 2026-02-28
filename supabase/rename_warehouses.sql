-- Migration: Rename Warehouses
-- Description: Rename TIENDA_PRINCIPAL to TIENDA_MUJERES and TIENDA_SECUNDARIA to TIENDA_HOMBRES
-- Date: 2026-02-20
-- 
-- IMPORTANT: Run this script to update existing data in your database

-- ============================================================================
-- UPDATE STOCK TABLE
-- ============================================================================

UPDATE stock 
SET warehouse_id = 'TIENDA_MUJERES' 
WHERE warehouse_id = 'TIENDA_PRINCIPAL';

UPDATE stock 
SET warehouse_id = 'TIENDA_HOMBRES' 
WHERE warehouse_id = 'TIENDA_SECUNDARIA';

-- ============================================================================
-- UPDATE MOVEMENTS TABLE
-- ============================================================================

UPDATE movements 
SET warehouse_id = 'TIENDA_MUJERES' 
WHERE warehouse_id = 'TIENDA_PRINCIPAL';

UPDATE movements 
SET warehouse_id = 'TIENDA_HOMBRES' 
WHERE warehouse_id = 'TIENDA_SECUNDARIA';

-- ============================================================================
-- UPDATE SALES TABLE
-- ============================================================================

UPDATE sales 
SET store_id = 'TIENDA_MUJERES' 
WHERE store_id = 'TIENDA_PRINCIPAL';

UPDATE sales 
SET store_id = 'TIENDA_HOMBRES' 
WHERE store_id = 'TIENDA_SECUNDARIA';

-- ============================================================================
-- VERIFY CHANGES
-- ============================================================================

-- Check stock
SELECT warehouse_id, COUNT(*) as count 
FROM stock 
GROUP BY warehouse_id;

-- Check movements
SELECT warehouse_id, COUNT(*) as count 
FROM movements 
GROUP BY warehouse_id;

-- Check sales
SELECT store_id, COUNT(*) as count 
FROM sales 
GROUP BY store_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE stock IS 'Updated: Warehouses renamed to TIENDA_MUJERES and TIENDA_HOMBRES';
COMMENT ON TABLE movements IS 'Updated: Warehouses renamed to TIENDA_MUJERES and TIENDA_HOMBRES';
COMMENT ON TABLE sales IS 'Updated: Stores renamed to TIENDA_MUJERES and TIENDA_HOMBRES';
