-- =====================================================
-- FIX: Eliminar constraint check_credit_limit
-- =====================================================
-- Problema: El constraint check_credit_limit impide que credit_used > credit_limit
-- Esto es incorrecto porque los clientes en mora DEBEN poder tener deuda mayor al límite
-- 
-- Ejemplo del error:
-- Cliente con credit_limit = 300.00 y credit_used = 574.98 (en mora)
-- El constraint impide actualizar/insertar este cliente
-- =====================================================

-- Verificar si el constraint existe
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'clients'::regclass
  AND conname = 'check_credit_limit';

-- Eliminar el constraint
ALTER TABLE clients 
  DROP CONSTRAINT IF EXISTS check_credit_limit;

-- Verificar que se eliminó
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'clients'::regclass
  AND conname = 'check_credit_limit';

-- =====================================================
-- EXPLICACIÓN
-- =====================================================
-- 
-- ¿Por qué eliminar este constraint?
-- 
-- 1. REALIDAD DEL NEGOCIO:
--    - Un cliente puede tener deuda vencida que exceda su límite
--    - Esto es normal en clientes morosos (rating E, DEUDA_VENCIDA)
--    - El límite de crédito es para NUEVAS ventas, no para deuda existente
-- 
-- 2. EJEMPLO REAL:
--    - Cliente tiene credit_limit = 300.00
--    - Compró productos por 574.98 a crédito
--    - No pagó a tiempo → ahora está en mora
--    - credit_used = 574.98 > credit_limit = 300.00
--    - Esto es VÁLIDO y debe permitirse
-- 
-- 3. LÓGICA CORRECTA:
--    - El límite de crédito se valida al CREAR una nueva venta
--    - Si (credit_used + nueva_venta) > credit_limit → rechazar venta
--    - Pero la deuda existente puede exceder el límite
-- 
-- 4. VALIDACIÓN CORRECTA:
--    - La validación debe estar en la lógica de negocio (actions/sales.ts)
--    - NO en un constraint de base de datos
--    - El constraint impide operaciones legítimas como:
--      * Actualizar datos del cliente
--      * Recalcular deuda
--      * Importar datos históricos
-- 
-- =====================================================

COMMENT ON COLUMN clients.credit_limit IS 
  'Límite de crédito para NUEVAS ventas. La deuda existente (credit_used) puede exceder este límite si el cliente está en mora.';

COMMENT ON COLUMN clients.credit_used IS 
  'Crédito actualmente usado. Puede ser mayor que credit_limit si el cliente tiene deuda vencida.';

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- 
-- ✅ El constraint check_credit_limit debe eliminarse
-- ✅ Los clientes con deuda > límite deben poder actualizarse
-- ✅ La validación de límite de crédito debe hacerse en la aplicación
-- 
-- =====================================================
