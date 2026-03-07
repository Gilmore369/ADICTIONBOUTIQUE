-- Comprehensive RLS Fix for All Catalog Tables
-- Ensures all CRUD operations work properly including soft deletes

-- ============================================================================
-- DROP ALL EXISTING CATALOG POLICIES
-- ============================================================================

-- Lines
DROP POLICY IF EXISTS "lines_view_active" ON lines;
DROP POLICY IF EXISTS "lines_manage" ON lines;
DROP POLICY IF EXISTS "lines_all" ON lines;
DROP POLICY IF EXISTS "lines_view_all" ON lines;
DROP POLICY IF EXISTS "lines_manage_all" ON lines;

-- Categories
DROP POLICY IF EXISTS "categories_view_active" ON categories;
DROP POLICY IF EXISTS "categories_manage" ON categories;
DROP POLICY IF EXISTS "categories_all" ON categories;
DROP POLICY IF EXISTS "categories_view_all" ON categories;
DROP POLICY IF EXISTS "categories_manage_all" ON categories;

-- Brands
DROP POLICY IF EXISTS "brands_view_active" ON brands;
DROP POLICY IF EXISTS "brands_manage" ON brands;
DROP POLICY IF EXISTS "brands_all" ON brands;
DROP POLICY IF EXISTS "brands_view_all" ON brands;
DROP POLICY IF EXISTS "brands_manage_all" ON brands;

-- Sizes
DROP POLICY IF EXISTS "sizes_view_active" ON sizes;
DROP POLICY IF EXISTS "sizes_manage" ON sizes;
DROP POLICY IF EXISTS "sizes_all" ON sizes;
DROP POLICY IF EXISTS "sizes_view_all" ON sizes;
DROP POLICY IF EXISTS "sizes_manage_all" ON sizes;

-- Suppliers
DROP POLICY IF EXISTS "suppliers_view_active" ON suppliers;
DROP POLICY IF EXISTS "suppliers_manage" ON suppliers;
DROP POLICY IF EXISTS "suppliers_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_view_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_manage_all" ON suppliers;

-- ============================================================================
-- CREATE NEW PERMISSIVE POLICIES WITH BOTH USING AND WITH CHECK
-- ============================================================================

-- Lines: Allow all operations for authenticated users
CREATE POLICY "lines_all_operations" ON lines
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Categories: Allow all operations for authenticated users
CREATE POLICY "categories_all_operations" ON categories
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Brands: Allow all operations for authenticated users
CREATE POLICY "brands_all_operations" ON brands
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Sizes: Allow all operations for authenticated users
CREATE POLICY "sizes_all_operations" ON sizes
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Suppliers: Allow all operations for authenticated users
CREATE POLICY "suppliers_all_operations" ON suppliers
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check all policies
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN '✅ USING'
        ELSE '❌ NO USING'
    END as has_using,
    CASE 
        WHEN with_check IS NOT NULL THEN '✅ WITH CHECK'
        ELSE '❌ NO WITH CHECK'
    END as has_with_check
FROM pg_policies 
WHERE tablename IN ('lines', 'categories', 'brands', 'sizes', 'suppliers')
ORDER BY tablename, policyname;

-- Test deletion on each table (uncomment to test)
-- UPDATE categories SET active = false WHERE name = 'Fragancias Niños' RETURNING id, name, active;
-- UPDATE lines SET active = false WHERE name = 'Test Line' RETURNING id, name, active;
-- UPDATE brands SET active = false WHERE name = 'Test Brand' RETURNING id, name, active;
-- UPDATE sizes SET active = false WHERE name = 'Test Size' RETURNING id, name, active;
-- UPDATE suppliers SET active = false WHERE name = 'Test Supplier' RETURNING id, name, active;
