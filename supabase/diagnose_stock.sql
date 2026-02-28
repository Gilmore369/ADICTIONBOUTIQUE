-- Diagnostic Script: Check Stock Status
-- Description: Verify current stock data and warehouse names
-- Date: 2026-02-20

-- ============================================================================
-- CHECK STOCK BY WAREHOUSE
-- ============================================================================

SELECT 
  warehouse_id,
  product_id,
  quantity,
  last_updated
FROM stock
WHERE product_id = 'a50e8400-e29b-41d4-a716-446655440001'
ORDER BY warehouse_id;

-- ============================================================================
-- CHECK ALL WAREHOUSE IDS IN USE
-- ============================================================================

SELECT DISTINCT warehouse_id, COUNT(*) as product_count
FROM stock
GROUP BY warehouse_id
ORDER BY warehouse_id;

-- ============================================================================
-- CHECK MOVEMENTS BY WAREHOUSE
-- ============================================================================

SELECT DISTINCT warehouse_id, COUNT(*) as movement_count
FROM movements
GROUP BY warehouse_id
ORDER BY warehouse_id;

-- ============================================================================
-- CHECK SALES BY STORE
-- ============================================================================

SELECT DISTINCT store_id, COUNT(*) as sale_count
FROM sales
GROUP BY store_id
ORDER BY store_id;

-- ============================================================================
-- CHECK PRODUCT EXISTS
-- ============================================================================

SELECT id, barcode, name, is_active
FROM products
WHERE id = 'a50e8400-e29b-41d4-a716-446655440001';
