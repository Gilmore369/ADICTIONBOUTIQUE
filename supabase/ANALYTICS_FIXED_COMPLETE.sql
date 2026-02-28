-- ============================================================================
-- ANALYTICS REPORTS - TODAS LAS FUNCIONES CORREGIDAS
-- ============================================================================
-- EJECUTAR ESTE ARCHIVO COMPLETO EN SUPABASE SQL EDITOR
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- 1. REPORTE: Rotación de Inventario
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_inventory_rotation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result jsonb;
BEGIN
  WITH sales_data AS (
    SELECT si.product_id, p.name, p.barcode,
      SUM(si.quantity) as total_sold,
      COUNT(DISTINCT s.id) as transactions
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '90 days')
      AND s.created_at <= COALESCE((filters->>'end_date')::timestamptz, NOW())
      AND (filters->>'store_id' IS NULL OR s.store_id = filters->>'store_id')
    GROUP BY si.product_id, p.name, p.barcode
  ),
  stock_data AS (
    SELECT product_id, SUM(quantity) as current_stock
    FROM stock
    WHERE (filters->>'warehouse_id' IS NULL OR warehouse_id = filters->>'warehouse_id')
    GROUP BY product_id
  ),
  combined AS (
    SELECT sd.*, COALESCE(st.current_stock, 0) as curre