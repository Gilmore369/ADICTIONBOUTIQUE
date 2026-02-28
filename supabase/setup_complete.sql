-- SCRIPT COMPLETO DE CONFIGURACIÓN
-- Ejecuta TODO de una vez: Usuario Admin + Stock + RLS

-- ============================================================================
-- PARTE 1: CREAR USUARIO ADMIN
-- ============================================================================

-- Insertar usuario admin (reemplaza UUID con el de tu usuario de Auth)
INSERT INTO users (id, email, name, roles, stores, active)
VALUES (
  '804419ec-cda6-4a6e-9388-c44f0058e635'::uuid,
  'gianpepex@gmail.com',
  'Admin User',
  ARRAY['admin'],
  ARRAY['TIENDA_PRINCIPAL', 'TIENDA_SECUNDARIA'],
  true
)
ON CONFLICT (id) DO UPDATE SET
  roles = ARRAY['admin'],
  stores = ARRAY['TIENDA_PRINCIPAL', 'TIENDA_SECUNDARIA'],
  active = true;

-- ============================================================================
-- PARTE 2: POBLAR STOCK
-- ============================================================================

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
('TIENDA_PRINCIPAL', 'a50e8400-e29b-41d4-a716-446655440010', 8),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440001', 10),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440002', 5),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440003', 8),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440004', 7),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440005', 4),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440006', 12),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440007', 10),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440008', 3),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440009', 12),
('TIENDA_SECUNDARIA', 'a50e8400-e29b-41d4-a716-446655440010', 6)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- ============================================================================
-- PARTE 3: HABILITAR RLS
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 4: ELIMINAR POLÍTICAS EXISTENTES
-- ============================================================================

DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- PARTE 5: CREAR POLÍTICAS PERMISIVAS
-- ============================================================================

CREATE POLICY "users_all" ON users FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "audit_log_all" ON audit_log FOR ALL USING (true);
CREATE POLICY "lines_all" ON lines FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "categories_all" ON categories FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "brands_all" ON brands FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "sizes_all" ON sizes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_all" ON suppliers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_all" ON products FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_all" ON stock FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "movements_all" ON movements FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "clients_all" ON clients FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "sales_all" ON sales FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "sale_items_all" ON sale_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "credit_plans_all" ON credit_plans FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "installments_all" ON installments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "payments_all" ON payments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "collection_actions_all" ON collection_actions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "cash_shifts_all" ON cash_shifts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "cash_expenses_all" ON cash_expenses FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

SELECT '✅ Usuario Admin' as status, email, roles FROM users WHERE email = 'gianpepex@gmail.com';
SELECT '✅ Stock' as status, warehouse_id, COUNT(*) as productos, SUM(quantity) as total FROM stock GROUP BY warehouse_id;
SELECT '✅ RLS' as status, tablename, CASE WHEN rowsecurity THEN 'HABILITADO' ELSE 'DESHABILITADO' END as rls FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products';
SELECT '✅ Políticas' as status, COUNT(*) as total FROM pg_policies WHERE schemaname = 'public';
