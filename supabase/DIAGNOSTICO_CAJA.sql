-- ============================================================================
-- DIAGNÓSTICO COMPLETO: Sistema de Caja
-- ============================================================================
-- Este script muestra toda la información relevante para diagnosticar
-- problemas con la apertura de turnos de caja
-- ============================================================================

\echo '=== 1. TURNOS ABIERTOS ACTUALMENTE ==='
SELECT 
  cs.id,
  cs.store_id,
  cs.opening_amount,
  cs.opened_at,
  u.email as usuario,
  u.roles as roles_usuario
FROM cash_shifts cs
LEFT JOIN users u ON cs.user_id = u.id
WHERE cs.status = 'OPEN'
ORDER BY cs.opened_at DESC;

\echo ''
\echo '=== 2. ÚLTIMOS 5 TURNOS (ABIERTOS Y CERRADOS) ==='
SELECT 
  cs.id,
  cs.store_id,
  cs.status,
  cs.opening_amount,
  cs.closing_amount,
  cs.opened_at,
  cs.closed_at,
  u.email as usuario
FROM cash_shifts cs
LEFT JOIN users u ON cs.user_id = u.id
ORDER BY cs.opened_at DESC
LIMIT 5;

\echo ''
\echo '=== 3. RESTRICCIONES EN TABLA cash_shifts ==='
SELECT 
  conname as nombre_restriccion,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'x' THEN 'EXCLUSION'
  END as tipo,
  pg_get_constraintdef(oid) as definicion
FROM pg_constraint
WHERE conrelid = 'cash_shifts'::regclass
ORDER BY contype;

\echo ''
\echo '=== 4. ÍNDICES EN TABLA cash_shifts ==='
SELECT 
  indexname as nombre_indice,
  indexdef as definicion
FROM pg_indexes
WHERE tablename = 'cash_shifts'
ORDER BY indexname;

\echo ''
\echo '=== 5. TRIGGERS EN TABLA cash_shifts ==='
SELECT 
  tgname as nombre_trigger,
  CASE 
    WHEN tgtype & 2 = 2 THEN 'BEFORE'
    WHEN tgtype & 64 = 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as momento,
  CASE 
    WHEN tgtype & 4 = 4 THEN 'INSERT'
    WHEN tgtype & 8 = 8 THEN 'DELETE'
    WHEN tgtype & 16 = 16 THEN 'UPDATE'
  END as evento,
  pg_get_triggerdef(oid) as definicion
FROM pg_trigger
WHERE tgrelid = 'cash_shifts'::regclass
  AND NOT tgisinternal;

\echo ''
\echo '=== 6. POLÍTICAS RLS EN cash_shifts ==='
SELECT 
  policyname as nombre_politica,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as comando,
  CASE permissive
    WHEN 'PERMISSIVE' THEN 'PERMISIVA'
    WHEN 'RESTRICTIVE' THEN 'RESTRICTIVA'
  END as tipo,
  qual as clausula_using,
  with_check as clausula_with_check
FROM pg_policies
WHERE tablename = 'cash_shifts'
ORDER BY policyname;

\echo ''
\echo '=== 7. USUARIO ADMINISTRADOR ==='
SELECT 
  id,
  email,
  roles,
  created_at
FROM users
WHERE email = 'gianpepex@gmail.com';

\echo ''
\echo '=== 8. RESUMEN Y DIAGNÓSTICO ==='
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM cash_shifts WHERE status = 'OPEN') = 0 
    THEN '✓ No hay turnos abiertos - puedes abrir turnos para ambas tiendas'
    WHEN (SELECT COUNT(*) FROM cash_shifts WHERE status = 'OPEN') = 1
    THEN '⚠ Hay 1 turno abierto - puedes abrir el turno de la otra tienda'
    WHEN (SELECT COUNT(*) FROM cash_shifts WHERE status = 'OPEN') >= 2
    THEN '✓ Hay ' || (SELECT COUNT(*) FROM cash_shifts WHERE status = 'OPEN')::text || ' turnos abiertos - ambas tiendas tienen turno activo'
  END as estado_turnos,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'cash_shifts'::regclass 
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%store_id%'
      AND pg_get_constraintdef(oid) LIKE '%status%'
    )
    THEN '✗ PROBLEMA: Existe restricción UNIQUE que bloquea múltiples turnos por tienda'
    ELSE '✓ No hay restricciones UNIQUE bloqueando múltiples turnos'
  END as estado_restricciones,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM users 
      WHERE email = 'gianpepex@gmail.com' 
      AND 'admin' = ANY(roles)
    )
    THEN '✓ Usuario admin existe y tiene rol correcto'
    ELSE '✗ PROBLEMA: Usuario admin no encontrado o sin rol admin'
  END as estado_usuario,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'cash_shifts'
      AND cmd IN ('*', 'a') -- ALL or INSERT
    )
    THEN '✓ Políticas RLS permiten insertar turnos'
    ELSE '⚠ Verificar políticas RLS - puede haber restricciones'
  END as estado_rls;

\echo ''
\echo '=== INSTRUCCIONES ==='
\echo 'Si ves "PROBLEMA" en alguna sección:'
\echo '1. Ejecuta: npx supabase db execute --file supabase/FIX_CASH_SHIFTS_MULTI_STORE.sql'
\echo '2. Si hay turnos abiertos que no deberían estar, ejecuta: npx supabase db execute --file supabase/CLOSE_ALL_OPEN_SHIFTS.sql'
\echo '3. Limpia el caché del navegador (Ctrl+Shift+Delete)'
\echo '4. Intenta abrir los turnos nuevamente'
