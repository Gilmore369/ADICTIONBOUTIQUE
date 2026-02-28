-- ============================================================================
-- Migration: RLS Correcta con JWT (sin recursión infinita)
-- ============================================================================
-- Estado actual: RLS completamente DESHABILITADA (riesgo de seguridad).
-- Solución: Re-habilitar usando public.has_role() y public.is_admin()
-- que son SECURITY DEFINER y no causan recursión.
-- ============================================================================

-- ============================================================================
-- RE-HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines               ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock               ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_actions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config       ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: USERS
-- ============================================================================
DROP POLICY IF EXISTS "users_self" ON users;
CREATE POLICY "users_self" ON users
  FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_admin" ON users;
CREATE POLICY "users_admin" ON users
  FOR ALL USING (public.is_admin());

-- ============================================================================
-- POLICIES: CATÁLOGOS (lectura libre para autenticados, escritura admin/vendedor)
-- ============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lines','categories','brands','sizes','suppliers']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "catalog_read_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "catalog_read_%s" ON %I FOR SELECT USING (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "catalog_write_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "catalog_write_%s" ON %I FOR ALL USING (public.has_role(''admin'') OR public.has_role(''vendedor''))', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- POLICIES: AUDIT LOG
-- ============================================================================
DROP POLICY IF EXISTS "audit_read" ON audit_log;
CREATE POLICY "audit_read" ON audit_log
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "audit_insert" ON audit_log;
CREATE POLICY "audit_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- POLICIES: PRODUCTS
-- ============================================================================
DROP POLICY IF EXISTS "products_read" ON products;
CREATE POLICY "products_read" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "products_write" ON products;
CREATE POLICY "products_write" ON products
  FOR ALL USING (public.has_role('admin') OR public.has_role('vendedor'));

-- ============================================================================
-- POLICIES: STOCK & MOVEMENTS (todos ven, solo admin/vendedor modifican)
-- ============================================================================
DROP POLICY IF EXISTS "stock_read" ON stock;
CREATE POLICY "stock_read" ON stock
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stock_write" ON stock;
CREATE POLICY "stock_write" ON stock
  FOR ALL USING (public.has_role('admin') OR public.has_role('vendedor'));

DROP POLICY IF EXISTS "movements_read" ON movements;
CREATE POLICY "movements_read" ON movements
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "movements_insert" ON movements;
CREATE POLICY "movements_insert" ON movements
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- POLICIES: STORES & WAREHOUSES
-- ============================================================================
DROP POLICY IF EXISTS "stores_read" ON stores;
CREATE POLICY "stores_read" ON stores
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stores_write" ON stores;
CREATE POLICY "stores_write" ON stores
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "warehouses_read" ON warehouses;
CREATE POLICY "warehouses_read" ON warehouses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "warehouses_write" ON warehouses;
CREATE POLICY "warehouses_write" ON warehouses
  FOR ALL USING (public.is_admin());

-- ============================================================================
-- POLICIES: CLIENTS
-- ============================================================================
DROP POLICY IF EXISTS "clients_read" ON clients;
CREATE POLICY "clients_read" ON clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "clients_write" ON clients;
CREATE POLICY "clients_write" ON clients
  FOR ALL USING (
    public.has_role('admin') OR
    public.has_role('vendedor') OR
    public.has_role('cobrador')
  );

-- ============================================================================
-- POLICIES: SALES (todos autenticados ven, admin/vendedor/cajero crean)
-- ============================================================================
DROP POLICY IF EXISTS "sales_read" ON sales;
CREATE POLICY "sales_read" ON sales
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert" ON sales
  FOR INSERT WITH CHECK (
    public.has_role('admin') OR
    public.has_role('vendedor') OR
    public.has_role('cajero')
  );

DROP POLICY IF EXISTS "sales_update_admin" ON sales;
CREATE POLICY "sales_update_admin" ON sales
  FOR UPDATE USING (public.is_admin());

-- ============================================================================
-- POLICIES: SALE_ITEMS
-- ============================================================================
DROP POLICY IF EXISTS "sale_items_read" ON sale_items;
CREATE POLICY "sale_items_read" ON sale_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
CREATE POLICY "sale_items_insert" ON sale_items
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- POLICIES: CRÉDITO (planes, cuotas, pagos, allocations)
-- ============================================================================
DROP POLICY IF EXISTS "credit_plans_read" ON credit_plans;
CREATE POLICY "credit_plans_read" ON credit_plans
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "credit_plans_write" ON credit_plans;
CREATE POLICY "credit_plans_write" ON credit_plans
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('vendedor') OR
    public.has_role('cajero') OR public.has_role('cobrador')
  );

DROP POLICY IF EXISTS "installments_read" ON installments;
CREATE POLICY "installments_read" ON installments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "installments_write" ON installments;
CREATE POLICY "installments_write" ON installments
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('cobrador')
  );

DROP POLICY IF EXISTS "payments_read" ON payments;
CREATE POLICY "payments_read" ON payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "payments_write" ON payments;
CREATE POLICY "payments_write" ON payments
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('cobrador')
  );

DROP POLICY IF EXISTS "palloc_read" ON payment_allocations;
CREATE POLICY "palloc_read" ON payment_allocations
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "palloc_write" ON payment_allocations;
CREATE POLICY "palloc_write" ON payment_allocations
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('cobrador')
  );

-- ============================================================================
-- POLICIES: COLLECTION ACTIONS
-- ============================================================================
DROP POLICY IF EXISTS "collection_read" ON collection_actions;
CREATE POLICY "collection_read" ON collection_actions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "collection_write" ON collection_actions;
CREATE POLICY "collection_write" ON collection_actions
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('cobrador')
  );

-- ============================================================================
-- POLICIES: CAJA
-- ============================================================================
DROP POLICY IF EXISTS "cash_shifts_read" ON cash_shifts;
CREATE POLICY "cash_shifts_read" ON cash_shifts
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cash_shifts_write" ON cash_shifts;
CREATE POLICY "cash_shifts_write" ON cash_shifts
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('cajero')
  );

DROP POLICY IF EXISTS "cash_expenses_read" ON cash_expenses;
CREATE POLICY "cash_expenses_read" ON cash_expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cash_expenses_write" ON cash_expenses;
CREATE POLICY "cash_expenses_write" ON cash_expenses
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('cajero')
  );

-- ============================================================================
-- POLICIES: SYSTEM CONFIG
-- ============================================================================
DROP POLICY IF EXISTS "sysconfig_read" ON system_config;
CREATE POLICY "sysconfig_read" ON system_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sysconfig_write" ON system_config;
CREATE POLICY "sysconfig_write" ON system_config
  FOR ALL USING (public.is_admin());

-- ============================================================================
-- NOTA: Las funciones RPC (analytics.*, get_dashboard_metrics, etc.) tienen
-- SECURITY DEFINER y bypass RLS internamente. El acceso se controla
-- a nivel de GRANT EXECUTE en cada función.
-- ============================================================================
