-- SCRIPT DE SEGURIDAD CRÍTICO
-- Habilita RLS en TODAS las tablas y crea políticas de acceso

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
-- PASO 2: ELIMINAR POLÍTICAS EXISTENTES (si hay conflictos)
-- ============================================================================

DROP POLICY IF EXISTS "users_view_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_view_all_admin" ON users;
DROP POLICY IF EXISTS "users_manage_admin" ON users;
DROP POLICY IF EXISTS "audit_log_view_admin" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_all" ON audit_log;
DROP POLICY IF EXISTS "lines_view_active" ON lines;
DROP POLICY IF EXISTS "categories_view_active" ON categories;
DROP POLICY IF EXISTS "brands_view_active" ON brands;
DROP POLICY IF EXISTS "sizes_view_active" ON sizes;
DROP POLICY IF EXISTS "suppliers_view_active" ON suppliers;
DROP POLICY IF EXISTS "products_view_active" ON products;
DROP POLICY IF EXISTS "stock_view_all" ON stock;
DROP POLICY IF EXISTS "clients_view_all" ON clients;
DROP POLICY IF EXISTS "sales_view_own_stores" ON sales;
DROP POLICY IF EXISTS "installments_view_all" ON installments;
DROP POLICY IF EXISTS "payments_view_all" ON payments;

-- ============================================================================
-- PASO 3: CREAR POLÍTICAS PERMISIVAS PARA USUARIOS AUTENTICADOS
-- ============================================================================

-- USERS: Ver y actualizar propio perfil
CREATE POLICY "users_view_own" ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- AUDIT LOG: Solo insertar (sistema)
CREATE POLICY "audit_log_insert_all" ON audit_log
  FOR INSERT
  WITH CHECK (true);

-- CATÁLOGOS: Todos los usuarios autenticados pueden ver
CREATE POLICY "lines_view_all" ON lines
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "lines_manage_all" ON lines
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "categories_view_all" ON categories
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "categories_manage_all" ON categories
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "brands_view_all" ON brands
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "brands_manage_all" ON brands
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "sizes_view_all" ON sizes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "sizes_manage_all" ON sizes
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "suppliers_view_all" ON suppliers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "suppliers_manage_all" ON suppliers
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- PRODUCTOS: Todos los usuarios autenticados
CREATE POLICY "products_view_all" ON products
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "products_manage_all" ON products
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- STOCK: Todos los usuarios autenticados
CREATE POLICY "stock_view_all" ON stock
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "stock_manage_all" ON stock
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- MOVEMENTS: Todos los usuarios autenticados
CREATE POLICY "movements_view_all" ON movements
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "movements_insert_all" ON movements
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- CLIENTES: Todos los usuarios autenticados
CREATE POLICY "clients_view_all" ON clients
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "clients_manage_all" ON clients
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- VENTAS: Todos los usuarios autenticados
CREATE POLICY "sales_view_all" ON sales
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "sales_insert_all" ON sales
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "sales_update_all" ON sales
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- SALE ITEMS: Todos los usuarios autenticados
CREATE POLICY "sale_items_view_all" ON sale_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "sale_items_insert_all" ON sale_items
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- CREDIT PLANS: Todos los usuarios autenticados
CREATE POLICY "credit_plans_view_all" ON credit_plans
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "credit_plans_insert_all" ON credit_plans
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- INSTALLMENTS: Todos los usuarios autenticados
CREATE POLICY "installments_view_all" ON installments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "installments_manage_all" ON installments
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- PAYMENTS: Todos los usuarios autenticados
CREATE POLICY "payments_view_all" ON payments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "payments_insert_all" ON payments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- COLLECTION ACTIONS: Todos los usuarios autenticados
CREATE POLICY "collection_actions_view_all" ON collection_actions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "collection_actions_insert_all" ON collection_actions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- CASH SHIFTS: Todos los usuarios autenticados
CREATE POLICY "cash_shifts_view_all" ON cash_shifts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cash_shifts_manage_all" ON cash_shifts
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- CASH EXPENSES: Todos los usuarios autenticados
CREATE POLICY "cash_expenses_view_all" ON cash_expenses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cash_expenses_manage_all" ON cash_expenses
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar que RLS está habilitado en todas las tablas
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'users', 'audit_log', 'lines', 'categories', 'brands', 'sizes', 
  'suppliers', 'products', 'stock', 'movements', 'clients', 
  'sales', 'sale_items', 'credit_plans', 'installments', 'payments',
  'collection_actions', 'cash_shifts', 'cash_expenses'
)
ORDER BY tablename;

-- Contar políticas por tabla
SELECT schemaname, tablename, COUNT(*) as num_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
