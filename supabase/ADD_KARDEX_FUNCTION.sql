-- ============================================================================
-- Agregar Función de Reporte Kardex
-- ============================================================================
-- Este script agrega la función analytics.report_kardex al schema analytics
-- Ejecutar en Supabase SQL Editor

-- ============================================================================
-- REPORTE: Kardex de Movimientos
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_kardex(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  warehouse_filter text;
  product_filter uuid;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '30 days');
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  warehouse_filter := filters->>'warehouse_id';
  product_filter := (filters->>'product_id')::uuid;

  WITH movements_data AS (
    SELECT 
      m.id,
      m.created_at,
      m.warehouse_id,
      m.product_id,
      p.barcode,
      p.name as product_name,
      m.type,
      m.quantity,
      m.reference,
      m.notes,
      -- Calcular balance acumulado usando window function
      SUM(
        CASE 
          WHEN m.type = 'ENTRADA' THEN m.quantity
          WHEN m.type = 'SALIDA' THEN -m.quantity
          WHEN m.type = 'AJUSTE' THEN m.quantity
          WHEN m.type = 'TRASPASO' THEN m.quantity
          ELSE 0
        END
      ) OVER (
        PARTITION BY m.product_id, m.warehouse_id 
        ORDER BY m.created_at, m.id
      ) as running_balance
    FROM movements m
    INNER JOIN products p ON m.product_id = p.id
    WHERE m.created_at >= start_date
      AND m.created_at <= end_date
      AND (warehouse_filter IS NULL OR m.warehouse_id = warehouse_filter)
      AND (product_filter IS NULL OR m.product_id = product_filter)
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_movements,
      COUNT(*) FILTER (WHERE type = 'ENTRADA') as total_entries,
      COUNT(*) FILTER (WHERE type = 'SALIDA') as total_exits,
      COUNT(*) FILTER (WHERE type = 'AJUSTE') as total_adjustments,
      COUNT(DISTINCT product_id) as unique_products
    FROM movements_data
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Movimientos', 'value', COALESCE((SELECT total_movements FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Entradas', 'value', COALESCE((SELECT total_entries FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Salidas', 'value', COALESCE((SELECT total_exits FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ajustes', 'value', COALESCE((SELECT total_adjustments FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Productos Afectados', 'value', COALESCE((SELECT unique_products FROM summary_stats), 0), 'format', 'number')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Movimientos por Tipo',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', type, 'y', count))
          FROM (
            SELECT 
              type,
              COUNT(*) as count
            FROM movements_data
            GROUP BY type
            ORDER BY 
              CASE type
                WHEN 'ENTRADA' THEN 1
                WHEN 'SALIDA' THEN 2
                WHEN 'AJUSTE' THEN 3
                WHEN 'TRASPASO' THEN 4
                ELSE 5
              END
          ) type_counts
        )
      ),
      jsonb_build_object(
        'name', 'Balance Acumulado en el Tiempo (Últimos 50 movimientos)',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI'), 'y', running_balance))
          FROM (
            SELECT created_at, running_balance
            FROM movements_data
            ORDER BY created_at DESC
            LIMIT 50
          ) recent_movements
          ORDER BY created_at
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS'),
          'warehouseId', warehouse_id,
          'barcode', barcode,
          'productName', product_name,
          'type', type,
          'quantity', ABS(quantity),
          'runningBalance', running_balance,
          'reference', COALESCE(reference, ''),
          'notes', COALESCE(notes, '')
        )
      )
      FROM movements_data
      ORDER BY created_at ASC, id ASC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'date', 'label', 'Fecha', 'type', 'date'),
        jsonb_build_object('key', 'warehouseId', 'label', 'Almacén', 'type', 'string'),
        jsonb_build_object('key', 'barcode', 'label', 'Código', 'type', 'string'),
        jsonb_build_object('key', 'productName', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'type', 'label', 'Tipo', 'type', 'string'),
        jsonb_build_object('key', 'quantity', 'label', 'Cantidad', 'type', 'number'),
        jsonb_build_object('key', 'runningBalance', 'label', 'Balance Acumulado', 'type', 'number'),
        jsonb_build_object('key', 'reference', 'label', 'Referencia', 'type', 'string'),
        jsonb_build_object('key', 'notes', 'label', 'Notas', 'type', 'string')
      )
    )
  ) INTO result
  FROM summary_stats;

  RETURN result;
END;
$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION analytics.report_kardex TO authenticated;

-- Verificar que la función se creó correctamente
SELECT 'Función analytics.report_kardex creada exitosamente' as status;
