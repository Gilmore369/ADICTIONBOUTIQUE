-- Debug Category Deletion Issue
-- Run this in Supabase SQL Editor

-- 1. Check current RLS policies on categories table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'categories'
ORDER BY policyname;

-- 2. Check if "Fragancias Niños" category exists and its current state
SELECT 
    id,
    name,
    line_id,
    active,
    created_at,
    updated_at
FROM categories
WHERE name = 'Fragancias Niños';

-- 3. Check current user and their roles
SELECT 
    auth.uid() as current_user_id,
    u.email,
    u.roles
FROM users u
WHERE u.id = auth.uid();

-- 4. Try to manually update the category to active=false
-- (This will show if RLS is blocking the update)
UPDATE categories
SET active = false
WHERE name = 'Fragancias Niños'
RETURNING id, name, active;

-- 5. Verify the update worked
SELECT 
    id,
    name,
    line_id,
    active,
    updated_at
FROM categories
WHERE name = 'Fragancias Niños';
