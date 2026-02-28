-- SCRIPT DE DIAGNÓSTICO RLS
-- Ejecuta esto para ver qué está bloqueando el acceso

-- 1. Ver usuarios en auth.users
SELECT 'AUTH USERS' as tabla, id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Ver usuarios en public.users
SELECT 'PUBLIC USERS' as tabla, id, email, name, roles 
FROM public.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Ver si los IDs coinciden
SELECT 
  'COINCIDENCIA' as check_type,
  au.id as auth_id,
  au.email as auth_email,
  pu.id as public_id,
  pu.email as public_email,
  CASE WHEN au.id = pu.id THEN '✅ COINCIDEN' ELSE '❌ NO COINCIDEN' END as status
FROM auth.users au
FULL OUTER JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC
LIMIT 5;

-- 4. Ver estado de RLS
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ HABILITADO' ELSE '❌ DESHABILITADO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('products', 'stock', 'lines', 'categories', 'brands')
ORDER BY tablename;

-- 5. Ver políticas activas
SELECT 
  tablename,
  policyname,
  cmd as operacion,
  CASE 
    WHEN qual::text LIKE '%auth.uid()%' THEN '🔒 Requiere Auth'
    WHEN qual::text = 'true' THEN '🔓 Abierto'
    ELSE '⚠️ Otro'
  END as tipo_acceso
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('products', 'stock', 'lines', 'categories', 'brands')
ORDER BY tablename, policyname;

-- 6. Contar datos en tablas
SELECT 'products' as tabla, COUNT(*) as registros FROM products
UNION ALL
SELECT 'stock', COUNT(*) FROM stock
UNION ALL
SELECT 'lines', COUNT(*) FROM lines
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'brands', COUNT(*) FROM brands
UNION ALL
SELECT 'clients', COUNT(*) FROM clients;
