-- ============================================================================
-- CLEANUP SCRIPT: Remove existing returns objects
-- ============================================================================
-- Este script elimina todos los objetos relacionados con la tabla returns
-- para poder ejecutar la migración limpiamente
-- 
-- ADVERTENCIA: Esto eliminará todos los datos de devoluciones existentes
-- ============================================================================

-- 1. Drop policies
DROP POLICY IF EXISTS "Authenticated users can view returns" ON returns;
DROP POLICY IF EXISTS "Authenticated users can create returns" ON returns;
DROP POLICY IF EXISTS "Authenticated users can update returns" ON returns;
DROP POLICY IF EXISTS "Only admins can delete returns" ON returns;

-- 2. Drop trigger
DROP TRIGGER IF EXISTS update_returns_updated_at ON returns;

-- 3. Drop indexes
DROP INDEX IF EXISTS idx_returns_sale_id;
DROP INDEX IF EXISTS idx_returns_client_id;
DROP INDEX IF EXISTS idx_returns_store_id;
DROP INDEX IF EXISTS idx_returns_return_number;
DROP INDEX IF EXISTS idx_returns_return_date;
DROP INDEX IF EXISTS idx_returns_status;
DROP INDEX IF EXISTS idx_returns_created_at;

-- 4. Drop functions
DROP FUNCTION IF EXISTS generate_return_number();
DROP FUNCTION IF EXISTS check_return_eligibility(UUID);

-- 5. Drop table
DROP TABLE IF EXISTS returns CASCADE;

-- ============================================================================
-- RESULTADO
-- ============================================================================
-- Todos los objetos relacionados con returns han sido eliminados
-- Ahora puedes ejecutar la migración 20260307000000_create_returns_table.sql
