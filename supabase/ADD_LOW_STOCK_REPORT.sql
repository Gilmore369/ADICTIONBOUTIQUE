-- ============================================================================
-- AGREGAR REPORTE: Stock Bajo
-- ============================================================================
-- Este script agrega la función analytics.report_low_stock
-- Ejecutar en Supabase SQL Editor

CREATE OR REPLACE FUNCTION analytics.report_low_stock(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  result jsonb;
  min_stock_filter integer;
  warehouse_filter text;
  category_filter uuid;
BEGIN
  -- Extraer filtros
  min_stock_filter := COALESCE((filters->>'min_stock')::integer, 5);
  warehouse_filter := filters->>'warehouse_id';
  category_filter := (filters->>'category_id')::uuid;

  WITH stock_data AS (
    SELECT 
      p.id,
      p.barcode,
      p.name,
      COALESCE(c.name, 'Sin categoría') as category,
      p.min_stock,
      COALESCE(SUM(s.quantity), 0) as current_stock,
      CASE 
        WHEN COALESCE(SUM(s.quantity), 0) = 0 THEN 'AGOTADO'
        WHEN COALESCE(SUM(s.quantity), 0) <= min_stock_filter THEN 'STOCK BAJO'
        ELSE 'NORMAL'
      END as status
    FROM products p
    LEFT JOIN stock s ON p.id = s.product_id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = true
      AND (warehouse_filter IS NULL OR s.warehouse_id = warehouse_filter OR s.warehouse_id IS NULL)
      AND (category_filter IS NULL OR p.category_id = category_filter)
    GROUP BY p.id, p.barcode, p.name, c.name, p.min_stock
    HAVING COALESCE(SUM(s.quantity), 0) <= min_stock_filter
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Productos con Stock Bajo', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Productos Agotados', 'value', COUNT(*) FILTER (WHERE current_stock = 0), 'format', 'number'),
      jsonb_build_object('label', 'Stock Mínimo Configurado', 'value', min_stock_filter, 'format', 'number')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Estado de Stock',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', status, 'y', count))
          FROM (
            SELECT 
              status,
              COUNT(*) as count
            FROM stock_data
            GROUP BY status
            ORDER BY 
              CASE status
                WHEN 'AGOTADO' THEN 1
                WHEN 'STOCK BAJO' THEN 2
                ELSE 3
              END
          ) status_counts
        )
      ),
      jsonb_build_object(
        'name', 'Top 20 Productos con Menor Stock',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', current_stock))
          FROM (
            SELECT name, current_stock
            FROM stock_data
            ORDER BY current_stock ASC, name
            LIMIT 20
          ) low_stock_products
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'barcode', barcode,
          'name', name,
          'category', category,
          'minStock', min_stock,
          'currentStock', current_stock,
          'status', status,
          'needed', GREATEST(min_stock - current_stock, 0)
        )
      )
      FROM stock_data
      ORDER BY current_stock ASC, name
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'Código', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'category', 'label', 'Categoría', 'type', 'string'),
        jsonb_build_object('key', 'minStock', 'label', 'Stock Mínimo', 'type', 'number'),
        jsonb_build_object('key', 'currentStock', 'label', 'Stock Actual', 'type', 'number'),
        jsonb_build_object('key', 'status', 'label', 'Estado', 'type', 'string'),
        jsonb_build_object('key', 'needed', 'label', 'Necesario', 'type', 'number')
      )
    )
  ) INTO result
  FROM stock_data;

  RETURN result;
END;
$;

-- Verificar que la función se creó correctamente
SELECT 'Función analytics.report_low_stock creada exitosamente' as mensaje;

-- Probar la función con filtros por defecto
SELECT 'Probando función con min_stock = 5' as test;
SELECT analytics.report_low_stock('{"min_stock": 5}'::jsonb);
