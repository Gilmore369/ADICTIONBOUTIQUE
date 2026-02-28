-- Verification Script: Check if database is ready for bulk product entry
-- Run this in Supabase SQL Editor to verify all required data exists

-- ============================================================================
-- 1. CHECK SUPPLIERS
-- ============================================================================
SELECT 
  'SUPPLIERS' as check_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM suppliers;

SELECT id, name, active FROM suppliers ORDER BY name LIMIT 5;

-- ============================================================================
-- 2. CHECK LINES
-- ============================================================================
SELECT 
  'LINES' as check_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM lines;

SELECT id, name, active FROM lines ORDER BY name LIMIT 5;

-- ============================================================================
-- 3. CHECK CATEGORIES
-- ============================================================================
SELECT 
  'CATEGORIES' as check_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM categories;

SELECT c.id, c.name, l.name as line_name, c.active 
FROM categories c
LEFT JOIN lines l ON c.line_id = l.id
ORDER BY l.name, c.name 
LIMIT 10;

-- ============================================================================
-- 4. CHECK BRANDS
-- ============================================================================
SELECT 
  'BRANDS' as check_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM brands;

SELECT id, name, active FROM brands ORDER BY name LIMIT 5;

-- ============================================================================
-- 5. CHECK SIZES (by category)
-- ============================================================================
SELECT 
  'SIZES' as check_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM sizes;

SELECT s.id, s.name, c.name as category_name, s.active
FROM sizes s
LEFT JOIN categories c ON s.category_id = c.id
ORDER BY c.name, s.name
LIMIT 10;

-- ============================================================================
-- 6. CHECK USERS (for permissions)
-- ============================================================================
SELECT 
  'USERS' as check_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM users;

SELECT id, email, name, roles, stores, active 
FROM users 
WHERE active = true
LIMIT 5;

-- ============================================================================
-- 7. CHECK EXISTING PRODUCTS (to verify structure)
-- ============================================================================
SELECT 
  'PRODUCTS' as check_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE active = true) as active_count
FROM products;

SELECT 
  barcode, 
  name, 
  color,
  size,
  price,
  active
FROM products 
ORDER BY created_at DESC 
LIMIT 5;

-- ============================================================================
-- 8. VERIFY WAREHOUSE IDs
-- ============================================================================
SELECT DISTINCT warehouse_id, COUNT(*) as product_count
FROM stock
GROUP BY warehouse_id
ORDER BY warehouse_id;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 
  'READY FOR BULK ENTRY' as status,
  (SELECT COUNT(*) FROM suppliers WHERE active = true) as suppliers,
  (SELECT COUNT(*) FROM lines WHERE active = true) as lines,
  (SELECT COUNT(*) FROM categories WHERE active = true) as categories,
  (SELECT COUNT(*) FROM brands WHERE active = true) as brands,
  (SELECT COUNT(*) FROM sizes WHERE active = true) as sizes,
  (SELECT COUNT(*) FROM users WHERE active = true) as users;

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
-- suppliers: >= 1
-- lines: >= 1
-- categories: >= 1
-- brands: >= 1
-- sizes: >= 1 (per category)
-- users: >= 1 (with CREATE_PRODUCT permission)
-- 
-- If any count is 0, run seed.sql first
