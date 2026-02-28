-- SCRIPT SIMPLIFICADO DE SEGURIDAD
-- Habilita RLS y crea políticas sin conflictos

-- ============================================================================
-- PASO 1: HABILITAR RLS EN TODAS LAS TABLAS
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
-- PASO 2: ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ============================================================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- PASO 3: CREAR POLÍTICAS PERMISIVAS (usuarios autenticados tienen acceso)
-- ============================================================================

-- USERS
CREATE POLICY "users_all" ON users FOR ALL USING (auth.uid() IS NOT NULL);

-- AUDIT LOG
CREATE POLICY "audit_log_all" ON audit_log FOR ALL USING (true);

-- CATÁLOGOS
CREATE POLICY "lines_all" ON lines FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "categories_all" ON categories FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "brands_all" ON brands FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "sizes_all" ON sizes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_all" ON suppliers FOR ALL USING (auth.uid() IS NOT NULL);

-- PRODUCTOS Y STOCK
CREATE POLICY "products_all" ON products FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_all" ON stock FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "movements_all" ON movements FOR ALL USING (auth.uid() IS NOT NULL);

-- CLIENTES
CREATE POLICY "clients_all" ON clients FOR ALL USING (auth.uid() IS NOT NULL);

-- VENTAS
CREATE POLICY "sales_all" ON sales FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "sale_items_all" ON sale_items FOR ALL USING (auth.uid() IS NOT NULL);

-- CRÉDITO
CREATE POLICY "credit_plans_all" ON credit_plans FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "installments_all" ON installments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "payments_all" ON payments FOR ALL USING (auth.uid() IS NOT NULL);

-- COBRANZAS
CREATE POLICY "collection_actions_all" ON collection_actions FOR ALL USING (auth.uid() IS NOT NULL);

-- CAJA
CREATE POLICY "cash_shifts_all" ON cash_shifts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "cash_expenses_all" ON cash_expenses FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Ver estado de RLS
SELECT tablename, 
       CASE WHEN rowsecurity THEN '✅ HABILITADO' ELSE '❌ DESHABILITADO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'users', 'audit_log', 'lines', 'categories', 'brands', 'sizes', 
  'suppliers', 'products', 'stock', 'movements', 'clients', 
  'sales', 'sale_items', 'credit_plans', 'installments', 'payments',
  'collection_actions', 'cash_shifts', 'cash_expenses'
)
ORDER BY tablename;

-- Contar políticas
SELECT COUNT(*) as total_policies FROM pg_policies WHERE schemaname = 'public';
