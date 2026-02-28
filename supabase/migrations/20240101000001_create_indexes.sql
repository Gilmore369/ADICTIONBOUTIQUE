-- Migration: Create Database Indexes
-- Description: Creates gin_trgm_ops indexes for full-text search and B-tree indexes for lookups
-- Requirements: 2.3, 9.8
-- Task: 2.2 Create database indexes

-- ============================================================================
-- FULL-TEXT SEARCH INDEXES (gin_trgm_ops)
-- ============================================================================

-- Products name search (Spanish full-text search with trigram)
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Clients name search (Spanish full-text search with trigram)
CREATE INDEX idx_clients_name_trgm ON clients USING gin(name gin_trgm_ops);

-- ============================================================================
-- LOOKUP INDEXES (B-tree for exact matches and range queries)
-- ============================================================================

-- Products lookups
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_line ON products(line_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);

-- Clients lookups
CREATE INDEX idx_clients_dni ON clients(dni);
CREATE INDEX idx_clients_active ON clients(active);

-- Sales lookups and filtering
CREATE INDEX idx_sales_client ON sales(client_id);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_store ON sales(store_id);
CREATE INDEX idx_sales_type ON sales(sale_type);
CREATE INDEX idx_sales_date ON sales(created_at DESC);
CREATE INDEX idx_sales_voided ON sales(voided);

-- Sale items lookups
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- Stock lookups (composite index for warehouse + product queries)
CREATE INDEX idx_stock_warehouse_product ON stock(warehouse_id, product_id);
CREATE INDEX idx_stock_product ON stock(product_id);

-- Movements lookups
CREATE INDEX idx_movements_warehouse ON movements(warehouse_id);
CREATE INDEX idx_movements_product ON movements(product_id);
CREATE INDEX idx_movements_date ON movements(created_at DESC);
CREATE INDEX idx_movements_type ON movements(type);

-- Credit plans lookups
CREATE INDEX idx_credit_plans_sale ON credit_plans(sale_id);
CREATE INDEX idx_credit_plans_client ON credit_plans(client_id);
CREATE INDEX idx_credit_plans_status ON credit_plans(status);

-- Installments lookups and filtering
CREATE INDEX idx_installments_plan ON installments(plan_id);
CREATE INDEX idx_installments_due_date ON installments(due_date);
CREATE INDEX idx_installments_status ON installments(status);
CREATE INDEX idx_installments_client_status ON installments(plan_id, status);

-- Payments lookups
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);

-- Collection actions lookups
CREATE INDEX idx_collection_actions_client ON collection_actions(client_id);
CREATE INDEX idx_collection_actions_user ON collection_actions(user_id);
CREATE INDEX idx_collection_actions_date ON collection_actions(created_at DESC);
CREATE INDEX idx_collection_actions_type ON collection_actions(action_type);
CREATE INDEX idx_collection_actions_result ON collection_actions(result);

-- Cash shifts lookups
CREATE INDEX idx_cash_shifts_store ON cash_shifts(store_id);
CREATE INDEX idx_cash_shifts_user ON cash_shifts(user_id);
CREATE INDEX idx_cash_shifts_opening ON cash_shifts(opened_at DESC);
CREATE INDEX idx_cash_shifts_status ON cash_shifts(status);

-- Cash expenses lookups
CREATE INDEX idx_cash_expenses_shift ON cash_expenses(shift_id);
CREATE INDEX idx_cash_expenses_user ON cash_expenses(user_id);
CREATE INDEX idx_cash_expenses_date ON cash_expenses(created_at DESC);
CREATE INDEX idx_cash_expenses_category ON cash_expenses(category);

-- Audit log lookups
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_operation ON audit_log(operation);

-- Catalog tables lookups
CREATE INDEX idx_categories_line ON categories(line_id);
CREATE INDEX idx_categories_active ON categories(active);
CREATE INDEX idx_sizes_category ON sizes(category_id);
CREATE INDEX idx_sizes_active ON sizes(active);
CREATE INDEX idx_lines_active ON lines(active);
CREATE INDEX idx_brands_active ON brands(active);
CREATE INDEX idx_suppliers_active ON suppliers(active);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_products_name_trgm IS 'Trigram index for fast fuzzy search on product names';
COMMENT ON INDEX idx_clients_name_trgm IS 'Trigram index for fast fuzzy search on client names';
COMMENT ON INDEX idx_products_barcode IS 'B-tree index for exact barcode lookups';
COMMENT ON INDEX idx_clients_dni IS 'B-tree index for exact DNI lookups';
COMMENT ON INDEX idx_sales_date IS 'Descending index for recent sales queries';
COMMENT ON INDEX idx_installments_due_date IS 'Index for overdue installment queries';
COMMENT ON INDEX idx_stock_warehouse_product IS 'Composite index for warehouse-product stock queries';
