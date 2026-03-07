-- Fix RLS Policies for Categories Deletion
-- This script ensures that authenticated users can soft-delete categories

-- Drop existing policies on categories table
DROP POLICY IF EXISTS "categories_view_active" ON categories;
DROP POLICY IF EXISTS "categories_manage" ON categories;
DROP POLICY IF EXISTS "categories_all" ON categories;
DROP POLICY IF EXISTS "categories_view_all" ON categories;
DROP POLICY IF EXISTS "categories_manage_all" ON categories;

-- Create a single permissive policy for all operations
-- This allows any authenticated user to SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "categories_all_operations" ON categories
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verify the policy was created
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'categories';

-- Test: Try to update a category to active=false
-- (Replace the ID with an actual category ID from your database)
SELECT 
    id,
    name,
    active
FROM categories
WHERE name = 'Fragancias Niños';

-- If you see the category above, try updating it:
-- UPDATE categories SET active = false WHERE name = 'Fragancias Niños' RETURNING *;
