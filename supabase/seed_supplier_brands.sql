-- Seed Data: Supplier-Brands Relationships
-- Description: Example data for multibrand suppliers
-- Date: 2024-02-20

-- ============================================================================
-- IMPORTANT: Run this AFTER seed.sql
-- ============================================================================

-- This script assumes you have suppliers and brands already created
-- Adjust the names to match your actual data

-- ============================================================================
-- EXAMPLE 1: Multibrand Supplier
-- ============================================================================

-- Supplier "Importadora Global" sells multiple brands
INSERT INTO supplier_brands (supplier_id, brand_id)
SELECT s.id, b.id
FROM suppliers s
CROSS JOIN brands b
WHERE s.name = 'Importadora Global'
AND b.name IN ('H&M', 'Zara', 'Forever 21')
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- ============================================================================
-- EXAMPLE 2: Single Brand Supplier
-- ============================================================================

-- Supplier "Distribuidora Nike" only sells Nike
INSERT INTO supplier_brands (supplier_id, brand_id)
SELECT s.id, b.id
FROM suppliers s
CROSS JOIN brands b
WHERE s.name = 'Distribuidora Nike'
AND b.name = 'Nike'
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- ============================================================================
-- EXAMPLE 3: Another Multibrand Supplier
-- ============================================================================

-- Supplier "Mayorista Fashion" sells various brands
INSERT INTO supplier_brands (supplier_id, brand_id)
SELECT s.id, b.id
FROM suppliers s
CROSS JOIN brands b
WHERE s.name = 'Mayorista Fashion'
AND b.name IN ('Adidas', 'Puma', 'Reebok')
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- ============================================================================
-- VERIFY DATA
-- ============================================================================

-- Check supplier-brand relationships
SELECT 
  s.name as supplier,
  b.name as brand
FROM supplier_brands sb
JOIN suppliers s ON sb.supplier_id = s.id
JOIN brands b ON sb.brand_id = b.id
ORDER BY s.name, b.name;

-- ============================================================================
-- NOTES
-- ============================================================================

-- To add more relationships:
-- 1. Find supplier_id: SELECT id, name FROM suppliers;
-- 2. Find brand_id: SELECT id, name FROM brands;
-- 3. Insert relationship:
--    INSERT INTO supplier_brands (supplier_id, brand_id)
--    VALUES ('supplier-uuid', 'brand-uuid');
