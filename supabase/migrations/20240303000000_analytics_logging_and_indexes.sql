-- ============================================================================
-- Analytics Reports - Logging and Performance Indexes
-- ============================================================================
-- Adds report execution logging table and performance indexes for analytics

-- ============================================================================
-- 1. Report Executions Logging Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics.report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  filters JSONB,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);

-- Índices para la tabla de ejecuciones
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON analytics.report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_user_id ON analytics.report_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_created_at ON analytics.report_executions(created_at);

-- ============================================================================
-- 2. Performance Indexes on Existing Tables
-- ============================================================================

-- Índices en sales para optimizar queries de reportes
CREATE INDEX IF NOT EXISTS idx_sales_created_at_not_voided ON sales(created_at) WHERE voided = false;
CREATE INDEX IF NOT EXISTS idx_sales_store_id_not_voided ON sales(store_id) WHERE voided = false;
CREATE INDEX IF NOT EXISTS idx_sales_sale_type_not_voided ON sales(sale_type) WHERE voided = false;
CREATE INDEX IF NOT EXISTS idx_sales_composite_analytics ON sales(created_at, store_id, sale_type) WHERE voided = false;

-- Índices en sale_items para optimizar JOINs
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_composite ON sale_items(sale_id, product_id);

-- Índices en stock para optimizar queries de inventario
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_warehouse_id ON stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_composite ON stock(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_quantity_positive ON stock(quantity) WHERE quantity > 0;

-- Índices en movements para optimizar queries de kardex y compras
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at);
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_composite ON movements(created_at, product_id, type);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse_id ON movements(warehouse_id);

-- Índices en products para optimizar JOINs
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active) WHERE active = true;

-- Índices en installments para optimizar queries de crédito
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_plan_id ON installments(plan_id);
CREATE INDEX IF NOT EXISTS idx_installments_overdue ON installments(due_date, status) WHERE status != 'PAID';

-- Índices en payments para optimizar queries de cobranza
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_installment_id ON payments(installment_id);

-- Índices en cash_expenses para optimizar queries de flujo de caja
CREATE INDEX IF NOT EXISTS idx_cash_expenses_created_at ON cash_expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_cash_expenses_shift_id ON cash_expenses(shift_id);

-- Índices en cash_shifts para optimizar filtros por tienda
CREATE INDEX IF NOT EXISTS idx_cash_shifts_store_id ON cash_shifts(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_created_at ON cash_shifts(created_at);

-- Índices en clients para optimizar queries de deuda
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_clients_credit_used ON clients(credit_used) WHERE credit_used > 0;

-- Índices en credit_plans para optimizar JOINs
CREATE INDEX IF NOT EXISTS idx_credit_plans_client_id ON credit_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_plans_sale_id ON credit_plans(sale_id);

-- ============================================================================
-- 3. Permisos
-- ============================================================================
GRANT SELECT, INSERT ON analytics.report_executions TO authenticated;

-- ============================================================================
-- 4. Comentarios para documentación
-- ============================================================================
COMMENT ON TABLE analytics.report_executions IS 'Registro de ejecuciones de reportes para auditoría y análisis de rendimiento';
COMMENT ON COLUMN analytics.report_executions.report_id IS 'Identificador del tipo de reporte ejecutado';
COMMENT ON COLUMN analytics.report_executions.user_id IS 'Usuario que ejecutó el reporte';
COMMENT ON COLUMN analytics.report_executions.filters IS 'Filtros aplicados en formato JSONB';
COMMENT ON COLUMN analytics.report_executions.execution_time_ms IS 'Tiempo de ejecución en milisegundos';
COMMENT ON COLUMN analytics.report_executions.error_message IS 'Mensaje de error si la ejecución falló';
