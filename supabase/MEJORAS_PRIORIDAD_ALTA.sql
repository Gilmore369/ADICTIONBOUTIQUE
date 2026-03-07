-- ============================================================================
-- MEJORAS DE PRIORIDAD ALTA - SEGURAS PARA EJECUTAR
-- ============================================================================
-- Descripción: Solo las mejoras críticas y seguras
-- Ejecutar DESPUÉS de verificar que no hay datos inconsistentes
-- ============================================================================

-- ============================================================================
-- PASO 1: VERIFICAR DATOS ANTES DE APLICAR CONSTRAINTS
-- ============================================================================

-- 1.1 Verificar clientes con credit_used > credit_limit
SELECT 
  id, 
  name, 
  credit_limit, 
  credit_used,
  (credit_used - credit_limit) as exceso
FROM clients 
WHERE credit_used > credit_limit
ORDER BY exceso DESC;

-- Si hay resultados, corregir antes de continuar:
-- UPDATE clients SET credit_used = credit_limit WHERE credit_used > credit_limit;

-- 1.2 Verificar ventas con total inconsistente
SELECT 
  id, 
  sale_number, 
  subtotal, 
  discount, 
  total,
  (subtotal - discount) as total_calculado,
  (total - (subtotal - discount)) as diferencia
FROM sales 
WHERE total != (subtotal - discount)
ORDER BY ABS(total - (subtotal - discount)) DESC;

-- Si hay resultados, corregir antes de continuar:
-- UPDATE sales SET total = (subtotal - discount) WHERE total != (subtotal - discount);

-- 1.3 Verificar múltiples cajas abiertas por tienda
SELECT 
  store_id, 
  COUNT(*) as cajas_abiertas,
  array_agg(id) as shift_ids
FROM cash_shifts 
WHERE status = 'OPEN' 
GROUP BY store_id 
HAVING COUNT(*) > 1;

-- Si hay resultados, cerrar las cajas extras manualmente antes de continuar

-- ============================================================================
-- PASO 2: APLICAR CONSTRAINTS (Solo si PASO 1 no tiene resultados)
-- ============================================================================

-- 2.1 Validar que credit_used no exceda credit_limit
DO $$ 
BEGIN
  ALTER TABLE clients 
    ADD CONSTRAINT check_credit_limit 
    CHECK (credit_used <= credit_limit);
  
  RAISE NOTICE 'Constraint check_credit_limit agregado exitosamente';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint check_credit_limit ya existe, omitiendo...';
END $$;

COMMENT ON CONSTRAINT check_credit_limit ON clients IS 
  'Ensures credit_used never exceeds credit_limit';

-- 2.2 Validar que los montos de venta sean consistentes
DO $$ 
BEGIN
  ALTER TABLE sales 
    ADD CONSTRAINT check_sale_total 
    CHECK (total = subtotal - discount);
  
  RAISE NOTICE 'Constraint check_sale_total agregado exitosamente';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint check_sale_total ya existe, omitiendo...';
END $$;

COMMENT ON CONSTRAINT check_sale_total ON sales IS 
  'Ensures total equals subtotal minus discount';

-- 2.3 Prevenir múltiples cajas abiertas por tienda
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_shift_per_store 
  ON cash_shifts(store_id) 
  WHERE status = 'OPEN';

COMMENT ON INDEX idx_one_open_shift_per_store IS 
  'Ensures only one open cash shift per store at a time';

-- ============================================================================
-- PASO 3: AGREGAR ON DELETE RESTRICT A FOREIGN KEYS CRÍTICOS
-- ============================================================================

-- 3.1 Products → Lines
DO $$ 
BEGIN
  ALTER TABLE products 
    DROP CONSTRAINT IF EXISTS products_line_id_fkey;
  
  ALTER TABLE products 
    ADD CONSTRAINT products_line_id_fkey 
    FOREIGN KEY (line_id) REFERENCES lines(id) 
    ON DELETE RESTRICT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating products_line_id_fkey: %', SQLERRM;
END $$;

-- 3.2 Products → Categories
DO $$ 
BEGIN
  ALTER TABLE products 
    DROP CONSTRAINT IF EXISTS products_category_id_fkey;
  
  ALTER TABLE products 
    ADD CONSTRAINT products_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) 
    ON DELETE RESTRICT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating products_category_id_fkey: %', SQLERRM;
END $$;

-- 3.3 Products → Brands
DO $$ 
BEGIN
  ALTER TABLE products 
    DROP CONSTRAINT IF EXISTS products_brand_id_fkey;
  
  ALTER TABLE products 
    ADD CONSTRAINT products_brand_id_fkey 
    FOREIGN KEY (brand_id) REFERENCES brands(id) 
    ON DELETE RESTRICT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating products_brand_id_fkey: %', SQLERRM;
END $$;

-- 3.4 Products → Suppliers
DO $$ 
BEGIN
  ALTER TABLE products 
    DROP CONSTRAINT IF EXISTS products_supplier_id_fkey;
  
  ALTER TABLE products 
    ADD CONSTRAINT products_supplier_id_fkey 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) 
    ON DELETE RESTRICT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating products_supplier_id_fkey: %', SQLERRM;
END $$;

-- 3.5 Categories → Lines
DO $$ 
BEGIN
  ALTER TABLE categories 
    DROP CONSTRAINT IF EXISTS categories_line_id_fkey;
  
  ALTER TABLE categories 
    ADD CONSTRAINT categories_line_id_fkey 
    FOREIGN KEY (line_id) REFERENCES lines(id) 
    ON DELETE RESTRICT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating categories_line_id_fkey: %', SQLERRM;
END $$;

-- 3.6 Sizes → Categories
DO $$ 
BEGIN
  ALTER TABLE sizes 
    DROP CONSTRAINT IF EXISTS sizes_category_id_fkey;
  
  ALTER TABLE sizes 
    ADD CONSTRAINT sizes_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) 
    ON DELETE RESTRICT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating sizes_category_id_fkey: %', SQLERRM;
END $$;

-- ============================================================================
-- PASO 4: VERIFICAR QUE TODO SE APLICÓ CORRECTAMENTE
-- ============================================================================

-- 4.1 Verificar constraints agregados
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid IN (
  'clients'::regclass,
  'sales'::regclass
)
AND conname LIKE 'check_%'
ORDER BY conrelid::regclass::text, conname;

-- 4.2 Verificar índice de caja única
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname = 'idx_one_open_shift_per_store';

-- 4.3 Verificar foreign keys con ON DELETE RESTRICT
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('products', 'categories', 'sizes')
  AND rc.delete_rule = 'RESTRICT'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================

/*
Si todo salió bien, deberías ver:

1. Constraints check_credit_limit y check_sale_total en las tablas
2. Índice idx_one_open_shift_per_store creado
3. Todos los FKs de products, categories, sizes con delete_rule = 'RESTRICT'

Si algún constraint falló, revisa los datos inconsistentes en PASO 1
*/
