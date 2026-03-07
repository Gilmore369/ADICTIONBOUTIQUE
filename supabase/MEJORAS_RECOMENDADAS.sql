-- ============================================================================
-- MEJORAS RECOMENDADAS PARA LA BASE DE DATOS
-- ============================================================================
-- Descripción: Script con mejoras de seguridad, integridad y performance
-- Prioridad: ALTA 🔴, MEDIA 🟡, BAJA 🟢
-- ============================================================================

-- ============================================================================
-- PRIORIDAD ALTA 🔴
-- ============================================================================

-- 1. Validar que credit_used no exceda credit_limit
-- Impacto: Previene sobregiro de crédito
ALTER TABLE clients 
  ADD CONSTRAINT check_credit_limit 
  CHECK (credit_used <= credit_limit);

COMMENT ON CONSTRAINT check_credit_limit ON clients IS 
  'Ensures credit_used never exceeds credit_limit';

-- 2. Agregar ON DELETE RESTRICT a foreign keys críticos
-- Impacto: Previene eliminación accidental de datos referenciados

-- Products → Lines
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS products_line_id_fkey,
  ADD CONSTRAINT products_line_id_fkey 
    FOREIGN KEY (line_id) REFERENCES lines(id) 
    ON DELETE RESTRICT;

-- Products → Categories
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS products_category_id_fkey,
  ADD CONSTRAINT products_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) 
    ON DELETE RESTRICT;

-- Products → Brands
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS products_brand_id_fkey,
  ADD CONSTRAINT products_brand_id_fkey 
    FOREIGN KEY (brand_id) REFERENCES brands(id) 
    ON DELETE RESTRICT;

-- Products → Suppliers
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS products_supplier_id_fkey,
  ADD CONSTRAINT products_supplier_id_fkey 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) 
    ON DELETE RESTRICT;

-- Categories → Lines
ALTER TABLE categories 
  DROP CONSTRAINT IF EXISTS categories_line_id_fkey,
  ADD CONSTRAINT categories_line_id_fkey 
    FOREIGN KEY (line_id) REFERENCES lines(id) 
    ON DELETE RESTRICT;

-- Sizes → Categories
ALTER TABLE sizes 
  DROP CONSTRAINT IF EXISTS sizes_category_id_fkey,
  ADD CONSTRAINT sizes_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) 
    ON DELETE RESTRICT;

-- 3. Validar que los montos de venta sean consistentes
-- Impacto: Previene inconsistencias en cálculos de venta
ALTER TABLE sales 
  ADD CONSTRAINT check_sale_total 
  CHECK (total = subtotal - discount);

COMMENT ON CONSTRAINT check_sale_total ON sales IS 
  'Ensures total equals subtotal minus discount';

-- ============================================================================
-- PRIORIDAD MEDIA 🟡
-- ============================================================================

-- 4. Prevenir múltiples cajas abiertas por tienda
-- Impacto: Evita conflictos en control de caja
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_shift_per_store 
  ON cash_shifts(store_id) 
  WHERE status = 'OPEN';

COMMENT ON INDEX idx_one_open_shift_per_store IS 
  'Ensures only one open cash shift per store at a time';

-- 5. Agregar índices compuestos para queries comunes
-- Impacto: Mejora performance de consultas frecuentes

-- Productos activos por línea y categoría
CREATE INDEX IF NOT EXISTS idx_products_line_category_active 
  ON products(line_id, category_id) 
  WHERE active = true;

-- Ventas por tienda y fecha (para reportes)
CREATE INDEX IF NOT EXISTS idx_sales_store_date 
  ON sales(store_id, created_at DESC) 
  WHERE NOT voided;

-- Cuotas vencidas por cliente
CREATE INDEX IF NOT EXISTS idx_installments_overdue 
  ON installments(plan_id, due_date) 
  WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE');

-- 6. Agregar validación en installments
-- Impacto: Previene cuotas con fechas en el pasado al momento de creación
-- Nota: credit_plans no tiene start_date/end_date, las fechas están en installments

-- Comentar esta validación ya que no aplica
-- ALTER TABLE credit_plans 
--   ADD CONSTRAINT check_plan_dates 
--   CHECK (end_date > start_date);

-- En su lugar, validar que installment_number sea secuencial
ALTER TABLE installments 
  ADD CONSTRAINT check_installment_number_positive 
  CHECK (installment_number > 0 AND installment_number <= 6);

COMMENT ON CONSTRAINT check_installment_number_positive ON installments IS 
  'Ensures installment_number is between 1 and 6';

-- 7. Validar que installments_count sea consistente
-- Impacto: Previene inconsistencias en número de cuotas
ALTER TABLE credit_plans 
  ADD CONSTRAINT check_installments_count 
  CHECK (installments_count BETWEEN 1 AND 6);

COMMENT ON CONSTRAINT check_installments_count ON credit_plans IS 
  'Ensures installments_count is between 1 and 6 (already in table definition but adding explicit constraint)';

-- 8. Validar que paid_amount no exceda amount en installments
ALTER TABLE installments 
  ADD CONSTRAINT check_installment_paid 
  CHECK (paid_amount <= amount);

COMMENT ON CONSTRAINT check_installment_paid ON installments IS 
  'Ensures paid_amount never exceeds installment amount';

-- ============================================================================
-- PRIORIDAD BAJA 🟢
-- ============================================================================

-- 9. Crear tabla de colores (normalización)
-- Impacto: Mejora consistencia de datos de colores
CREATE TABLE IF NOT EXISTS colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  hex_code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar colores comunes
INSERT INTO colors (name, hex_code) VALUES
  ('Negro', '#000000'),
  ('Blanco', '#FFFFFF'),
  ('Rojo', '#FF0000'),
  ('Azul', '#0000FF'),
  ('Verde', '#00FF00'),
  ('Amarillo', '#FFFF00'),
  ('Rosado', '#FFC0CB'),
  ('Morado', '#800080'),
  ('Naranja', '#FFA500'),
  ('Gris', '#808080'),
  ('Café', '#8B4513'),
  ('Beige', '#F5F5DC')
ON CONFLICT (name) DO NOTHING;

-- Nota: Para migrar products.color a FK, ejecutar script separado

-- 10. Crear vista materializada para reportes de ventas
-- Impacto: Mejora performance de reportes
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sales_daily_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  store_id,
  sale_type,
  COUNT(*) as total_sales,
  SUM(subtotal) as total_subtotal,
  SUM(discount) as total_discount,
  SUM(total) as total_amount,
  COUNT(DISTINCT client_id) as unique_clients
FROM sales
WHERE NOT voided
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sales_daily_summary 
  ON mv_sales_daily_summary(date, store_id, sale_type);

COMMENT ON MATERIALIZED VIEW mv_sales_daily_summary IS 
  'Daily sales summary by store and type. Refresh daily.';

-- Crear función para refrescar la vista
CREATE OR REPLACE FUNCTION refresh_sales_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_daily_summary;
END;
$$ LANGUAGE plpgsql;

-- 11. Agregar función para calcular balance de crédito
CREATE OR REPLACE FUNCTION calculate_client_balance(client_uuid UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_balance DECIMAL(10,2);
BEGIN
  -- Sumar el balance de todas las cuotas pendientes del cliente
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO total_balance
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE cp.client_id = client_uuid
    AND cp.status = 'ACTIVE'
    AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE');
  
  RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_client_balance IS 
  'Calculates total outstanding balance for a client from active installments';

-- 12. Agregar función para obtener cuotas vencidas
CREATE OR REPLACE FUNCTION get_overdue_installments(days_overdue INTEGER DEFAULT 0)
RETURNS TABLE (
  installment_id UUID,
  plan_id UUID,
  client_id UUID,
  client_name TEXT,
  installment_number INTEGER,
  amount DECIMAL(10,2),
  paid_amount DECIMAL(10,2),
  balance DECIMAL(10,2),
  due_date DATE,
  days_late INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.plan_id,
    cp.client_id,
    c.name,
    i.installment_number,
    i.amount,
    i.paid_amount,
    (i.amount - i.paid_amount) as balance,
    i.due_date,
    (CURRENT_DATE - i.due_date)::INTEGER as days_late
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  JOIN clients c ON cp.client_id = c.id
  WHERE i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
    AND i.due_date < CURRENT_DATE - days_overdue
    AND c.active = true
  ORDER BY i.due_date ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_overdue_installments IS 
  'Returns all overdue installments with client details and calculated balance';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar constraints agregados
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid IN (
  'clients'::regclass,
  'sales'::regclass,
  'credit_plans'::regclass,
  'installments'::regclass
)
AND conname LIKE 'check_%'
ORDER BY conrelid::regclass::text, conname;

-- Verificar índices creados
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
  AND tablename IN ('products', 'sales', 'installments', 'cash_shifts')
ORDER BY tablename, indexname;

-- Verificar foreign keys con ON DELETE
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
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
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

/*
ANTES DE EJECUTAR EN PRODUCCIÓN:

1. BACKUP: Hacer backup completo de la base de datos
   - Supabase Dashboard → Settings → Database → Backups

2. TESTING: Probar en ambiente de desarrollo primero

3. CONSTRAINTS: Los constraints pueden fallar si hay datos existentes que los violan
   - Ejecutar queries de verificación primero
   - Limpiar datos inconsistentes antes de agregar constraints

4. ÍNDICES: Los índices pueden tardar en crearse en tablas grandes
   - Considerar crear índices CONCURRENTLY en producción
   - Monitorear performance durante la creación

5. VISTAS MATERIALIZADAS: Requieren refresh periódico
   - Configurar cron job o trigger para refresh automático
   - Considerar impacto en performance durante refresh

6. FOREIGN KEYS: Cambiar ON DELETE puede afectar comportamiento existente
   - Revisar código de aplicación que dependa de CASCADE
   - Actualizar lógica de eliminación si es necesario

QUERIES DE VERIFICACIÓN ANTES DE APLICAR:

-- Verificar clientes con credit_used > credit_limit
SELECT id, name, credit_limit, credit_used 
FROM clients 
WHERE credit_used > credit_limit;

-- Verificar ventas con total inconsistente
SELECT id, sale_number, subtotal, discount, total 
FROM sales 
WHERE total != (subtotal - discount);

-- Verificar múltiples cajas abiertas por tienda
SELECT store_id, COUNT(*) 
FROM cash_shifts 
WHERE status = 'OPEN' 
GROUP BY store_id 
HAVING COUNT(*) > 1;

-- Verificar credit_plans con installments_count fuera de rango
SELECT id, installments_count, total_amount 
FROM credit_plans 
WHERE installments_count < 1 OR installments_count > 6;

-- Verificar installments con paid_amount > amount
SELECT id, amount, paid_amount 
FROM installments 
WHERE paid_amount > amount;
*/
