-- ============================================================================
-- REPORTES CORREGIDOS - EJECUTAR ESTE ARCHIVO
-- ============================================================================
-- Este archivo contiene TODAS las funciones de reportes corregidas
-- Ejecuta este archivo completo en Supabase SQL Editor
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- 1. REPORTE: Rotación de Inventario (CORREGIDO)
CREATE OR REPLACE FUNCTION analytics.report_inventory_rotation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
  warehouse_filter text;
BEGIN
  start_date := COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '90 days');
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';
  warehouse_filter := filters->>'warehouse_id';

  WITH sales_data AS (
    SELECT 
      si.product_id, p.name, p.barcode,
      SUM(si.quantity) as total_sold,
      COUNT(DISTINCT s.id) as transactions
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= start_date AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY si.product_id, p.name, p.barcode
  ),
  stock_data AS (
    SELECT product_id, SUM(quantity) as current_stock
    FROM stock
    WHERE (warehouse_filter IS NULL OR warehouse_id = warehouse_filter)
    GROUP BY product_id
  ),
  combined_data AS (
    SELECT 
      sd.product_id, sd.barcode, sd.name, sd.total_sold, sd.transactions,
      COALESCE(st.current_stock, 0) as current_stock,
      COALESCE(ROUND(sd.total_sold / NULLIF(st.current_stock, 0), 2), 0) as rotation
    FROM sales_data sd
    LEFT JOIN stock_data st ON sd.product_id = st.product_id
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Productos Analizados', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Total Vendido', 'value', COALESCE(SUM(total_sold), 0), 'format', 'number'),
      jsonb_build_object('label', 'Rotación Promedio', 'value', COALESCE(ROUND(AVG(rotation), 2), 0), 'format', 'decimal')
    ),
    'series', jsonb_build_array(
      jsonb_build_object('name', 'Rotación por Producto', 'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', rotation))
          FROM (SELECT name, rotation FROM combined_data ORDER BY total_sold DESC LIMIT 20) top_products
        ))
    ),
    'rows', (
      SELECT jsonb_agg(jsonb_build_object(
          'barcode', barcode, 'name', name, 'totalSold', total_sold,
          'currentStock', current_stock, 'rotation', rotation, 'transactions', transactions
        ))
      FROM combined_data ORDER BY total_sold DESC
    ),
    'meta', jsonb_build_object('columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'Código', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'totalSold', 'label', 'Vendidos', 'type', 'number'),
        jsonb_build_object('key', 'currentStock', 'label', 'Stock Actual', 'type', 'number'),
        jsonb_build_object('key', 'rotation', 'label', 'Rotación', 'type', 'decimal'),
        jsonb_build_object('key', 'transactions', 'label', 'Transacciones', 'type', 'number')
      ))
  ) INTO result FROM combined_data;
  RETURN result;
END;
$$;

-- 2. Crear wrappers en schema public
CREATE OR REPLACE FUNCTION public.report_inventory_rotation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_inventory_rotation(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_inventory_valuation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_inventory_valuation(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_low_stock(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_low_stock(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_timeline(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_timeline(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_by_month(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_by_month(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_by_product(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_by_product(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_by_category(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_by_category(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_credit_vs_cash(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_credit_vs_cash(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_summary(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_summary(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_by_store(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_by_store(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_kardex(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_kardex(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_purchases_by_supplier(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_purchases_by_supplier(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_purchases_by_period(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_purchases_by_period(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_clients_debt(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_clients_debt(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_overdue_installments(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_overdue_installments(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_collection_effectiveness(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_collection_effectiveness(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_profit_margin(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_profit_margin(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_cash_flow(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_cash_flow(filters); END; $$;

-- 3. Otorgar permisos
GRANT EXECUTE ON FUNCTION public.report_inventory_rotation TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_inventory_valuation TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_low_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_by_month TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_by_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_credit_vs_cash TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_by_store TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_kardex TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_purchases_by_supplier TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_purchases_by_period TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_clients_debt TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_overdue_installments TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_collection_effectiveness TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_profit_margin TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_cash_flow TO authenticated;
