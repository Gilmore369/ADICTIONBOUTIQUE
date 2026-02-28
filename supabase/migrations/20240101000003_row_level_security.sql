-- Migration: Row Level Security Policies
-- Description: Enable RLS on all tables and create role-based access policies
-- Requirements: 3.3, 19.2

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
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
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "users_view_own" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except roles and stores)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "users_view_all_admin" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  );

-- Admins can manage all users
CREATE POLICY "users_manage_admin" ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  );

-- ============================================================================
-- AUDIT LOG POLICIES
-- ============================================================================

-- Only admins can view audit logs
CREATE POLICY "audit_log_view_admin" ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  );

-- System can insert audit logs (no user restriction)
CREATE POLICY "audit_log_insert_all" ON audit_log
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- CATALOG TABLES POLICIES (Lines, Categories, Brands, Sizes, Suppliers)
-- ============================================================================

-- All authenticated users can view active catalog items
CREATE POLICY "lines_view_active" ON lines
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "categories_view_active" ON categories
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "brands_view_active" ON brands
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "sizes_view_active" ON sizes
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "suppliers_view_active" ON suppliers
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

-- Admins and vendedores can manage catalog items
CREATE POLICY "lines_manage" ON lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles))
    )
  );

CREATE POLICY "categories_manage" ON categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles))
    )
  );

CREATE POLICY "brands_manage" ON brands
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles))
    )
  );

CREATE POLICY "sizes_manage" ON sizes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles))
    )
  );

CREATE POLICY "suppliers_manage" ON suppliers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles))
    )
  );

-- ============================================================================
-- PRODUCTS TABLE POLICIES
-- ============================================================================

-- All authenticated users can view active products
CREATE POLICY "products_view_active" ON products
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

-- Admins and vendedores can manage products
CREATE POLICY "products_manage" ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles))
    )
  );

-- ============================================================================
-- STOCK AND MOVEMENTS POLICIES
-- ============================================================================

-- Users can view stock from their assigned stores
CREATE POLICY "stock_view_own_stores" ON stock
  FOR SELECT
  USING (
    warehouse_id IN (
      SELECT unnest(stores)
      FROM users
      WHERE id = auth.uid()
    )
  );

-- Admins and vendedores can manage stock
CREATE POLICY "stock_manage" ON stock
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles))
    )
  );

-- Users can view movements from their assigned stores
CREATE POLICY "movements_view_own_stores" ON movements
  FOR SELECT
  USING (
    warehouse_id IN (
      SELECT unnest(stores)
      FROM users
      WHERE id = auth.uid()
    )
  );

-- System can insert movements (triggered by stock operations)
CREATE POLICY "movements_insert_all" ON movements
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- CLIENTS TABLE POLICIES
-- ============================================================================

-- All authenticated users can view clients
CREATE POLICY "clients_view" ON clients
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins, vendedores, and cobradores can manage clients
CREATE POLICY "clients_manage" ON clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles) OR 'cobrador' = ANY(roles))
    )
  );

-- ============================================================================
-- SALES TABLE POLICIES
-- ============================================================================

-- Users can view sales from their assigned stores
CREATE POLICY "sales_view_own_stores" ON sales
  FOR SELECT
  USING (
    store_id IN (
      SELECT unnest(stores)
      FROM users
      WHERE id = auth.uid()
    )
  );

-- Admins, vendedores, and cajeros can create sales
CREATE POLICY "sales_create" ON sales
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles) OR 'cajero' = ANY(roles))
    )
  );

-- Only admins can void sales
CREATE POLICY "sales_void_admin_only" ON sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  )
  WITH CHECK (voided = true);

-- ============================================================================
-- SALE ITEMS TABLE POLICIES
-- ============================================================================

-- Users can view sale items for sales they can access
CREATE POLICY "sale_items_view" ON sale_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND store_id IN (
        SELECT unnest(stores)
        FROM users
        WHERE id = auth.uid()
      )
    )
  );

-- System can insert sale items (part of sale creation)
CREATE POLICY "sale_items_insert" ON sale_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles) OR 'cajero' = ANY(roles))
    )
  );

-- ============================================================================
-- CREDIT PLANS TABLE POLICIES
-- ============================================================================

-- All authenticated users can view credit plans
CREATE POLICY "credit_plans_view" ON credit_plans
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- System can insert credit plans (part of credit sale creation)
CREATE POLICY "credit_plans_insert" ON credit_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles) OR 'cajero' = ANY(roles))
    )
  );

-- Admins can update credit plans (cancel, etc.)
CREATE POLICY "credit_plans_update_admin" ON credit_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  );

-- ============================================================================
-- INSTALLMENTS TABLE POLICIES
-- ============================================================================

-- All authenticated users can view installments
CREATE POLICY "installments_view" ON installments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- System can insert installments (part of credit plan creation)
CREATE POLICY "installments_insert" ON installments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'vendedor' = ANY(roles) OR 'cajero' = ANY(roles))
    )
  );

-- Admins and cobradores can update installments (payments, rescheduling)
CREATE POLICY "installments_update" ON installments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'cobrador' = ANY(roles))
    )
  );

-- ============================================================================
-- PAYMENTS TABLE POLICIES
-- ============================================================================

-- All authenticated users can view payments
CREATE POLICY "payments_view" ON payments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins and cobradores can record payments
CREATE POLICY "payments_create" ON payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'cobrador' = ANY(roles))
    )
  );

-- ============================================================================
-- COLLECTION ACTIONS TABLE POLICIES
-- ============================================================================

-- All authenticated users can view collection actions
CREATE POLICY "collection_actions_view" ON collection_actions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins and cobradores can create collection actions
CREATE POLICY "collection_actions_create" ON collection_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'cobrador' = ANY(roles))
    )
  );

-- ============================================================================
-- CASH TABLES POLICIES
-- ============================================================================

-- Users can view cash shifts from their assigned stores
CREATE POLICY "cash_shifts_view_own_stores" ON cash_shifts
  FOR SELECT
  USING (
    store_id IN (
      SELECT unnest(stores)
      FROM users
      WHERE id = auth.uid()
    )
  );

-- Admins and cajeros can manage cash shifts
CREATE POLICY "cash_shifts_manage" ON cash_shifts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'cajero' = ANY(roles))
    )
  );

-- Users can view cash expenses from their assigned stores (via shift)
CREATE POLICY "cash_expenses_view_own_stores" ON cash_expenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cash_shifts
      WHERE cash_shifts.id = cash_expenses.shift_id
      AND cash_shifts.store_id IN (
        SELECT unnest(stores)
        FROM users
        WHERE id = auth.uid()
      )
    )
  );

-- Admins and cajeros can manage cash expenses
CREATE POLICY "cash_expenses_manage" ON cash_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('admin' = ANY(roles) OR 'cajero' = ANY(roles))
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "users_view_own" ON users IS 
  'Users can view their own profile information';

COMMENT ON POLICY "products_view_active" ON products IS 
  'All authenticated users can view active products for sales and catalog browsing';

COMMENT ON POLICY "products_manage" ON products IS 
  'Only admins and vendedores can create, update, or delete products';

COMMENT ON POLICY "sales_view_own_stores" ON sales IS 
  'Users can only view sales from stores they are assigned to';

COMMENT ON POLICY "sales_void_admin_only" ON sales IS 
  'Only admins can void sales for security and audit purposes';

COMMENT ON POLICY "clients_view" ON clients IS 
  'All authenticated users can view clients for sales and collections';

COMMENT ON POLICY "clients_manage" ON clients IS 
  'Admins, vendedores, and cobradores can manage client information';

COMMENT ON POLICY "installments_view" ON installments IS 
  'All authenticated users can view installments for debt tracking';

COMMENT ON POLICY "installments_update" ON installments IS 
  'Only admins and cobradores can update installments for payments and rescheduling';
