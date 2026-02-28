-- SCRIPT FINAL: Deshabilitar RLS + Poblar Stock + Verificar

-- ============================================================================
-- PARTE 1: DESHABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE sizes DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE installments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE collection_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_expenses DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 2: VERIFICAR Y POBLAR STOCK
-- ============================================================================

-- Ver stock actual
SELECT 'STOCK ACTUAL' as info, warehouse_id, COUNT(*) as productos, SUM(quantity) as total
FROM stock
GROUP BY warehouse_id;

-- Si está vacío, insertar
INSERT INTO stock (warehouse_id, product_id, quantity) VALUES
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440001', 15),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440002', 8),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440003', 12),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440004', 10),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440005', 6),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440006', 20),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440007', 15),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440008', 5),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440009', 18),
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440010', 8)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- ============================================================================
-- PARTE 3: VERIFICACIÓN FINAL
-- ============================================================================

-- Ver RLS deshabilitado
SELECT tablename, 
       CASE WHEN rowsecurity THEN '🔒 PROTEGIDO' ELSE '✅ ABIERTO' END as estado
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('products', 'stock', 'movements')
ORDER BY tablename;

-- Ver stock actualizado
SELECT 'STOCK FINAL' as info, warehouse_id, COUNT(*) as productos, SUM(quantity) as total
FROM stock
GROUP BY warehouse_id;

-- Ver productos disponibles
SELECT 'PRODUCTOS' as info, COUNT(*) as total FROM products WHERE active = true;
