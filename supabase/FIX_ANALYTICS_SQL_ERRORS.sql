-- ============================================================================
-- FIX: Corregir errores de SQL en funciones de analytics
-- ============================================================================

-- 1. FIX: report_inventory_rotation - Error de GROUP BY
CREATE OR REPLACE FUNCTION analytics.report_inventory_rotation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
  warehouse_filter text;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '90 days');
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';
  warehouse_filter := filters->>'warehouse_id';

  WITH sales_data AS (
    SELECT 
      si.product_id,
      p.name,
      p.barcode,
      SUM(si.quantity) as total_sold,
      COUNT(DISTINCT s.id) as transactions
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY si.product_id, p.name, p.barcode
  ),
  stock_data AS (
    SELECT 
      product_id,
      SUM(quantity) as current_stock
    FROM stock
    WHERE (warehouse_filter IS NULL OR warehouse_id = warehouse_filter)
    GROUP BY product_id
  ),
  combined_data AS (
    SELECT 
      sd.product_id,
      sd.barcode,
      sd.name,
      sd.total_sold,
      sd.transactions,
      COALESCE(st.current_stock, 0) as current_stock,
      COALESCE(ROUND(sd.total_sold / NULLIF(st.current_stock, 0), 2), 0) as rotation,
      COALESCE(ROUND(365.0 / NULLIF(sd.total_sold / NULLIF(st.current_stock, 0), 0), 0), 0) as days_inventory
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
      jsonb_build_object(
        'name', 'Rotación por Producto',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', rotation))
          FROM (
            SELECT name, rotation
            FROM combined_data
            ORDER BY total_sold DESC
            LIMIT 20
          ) top_products
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'barcode', barcode,
          'name', name,
          'totalSold', total_sold,
          'currentStock', current_stock,
          'rotation', rotation,
          'daysInventory', days_inventory,
          'transactions', transactions
        )
      )
      FROM combined_data
      ORDER BY total_sold DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'Código', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'totalSold', 'label', 'Vendidos', 'type', 'number'),
        jsonb_build_object('key', 'currentStock', 'label', 'Stock Actual', 'type', 'number'),
        jsonb_build_object('key', 'rotation', 'label', 'Rotación', 'type', 'decimal'),
        jsonb_build_object('key', 'daysInventory', 'label', 'Días Inventario', 'type', 'number'),
        jsonb_build_object('key', 'transactions', 'label', 'Transacciones', 'type', 'number')
      )
    )
  ) INTO result
  FROM combined_data;

  RETURN result;
END;
$$;

-- 2. FIX: report_purchases_by_supplier - Error de GROUP BY
CREATE OR REPLACE FUNCTION analytics.report_purchases_by_supplier(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  supplier_filter uuid;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '90 days');
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  supplier_filter := (filters->>'supplier_id')::uuid;

  WITH purchase_movements AS (
    SELECT 
      p.supplier_id,
      s.name as supplier_name,
      m.product_id,
      p.barcode,
      p.name as product_name,
      SUM(m.quantity) as total_quantity,
      ROUND(SUM(m.quantity * COALESCE(p.purchase_price, 0)), 2) as total_cost,
      COUNT(DISTINCT m.id) as movement_count
    FROM movements m
    INNER JOIN products p ON m.product_id = p.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE m.type = 'ENTRADA'
      AND m.created_at >= start_date
      AND m.created_at <= end_date
      AND (supplier_filter IS NULL OR p.supplier_id = supplier_filter)
    GROUP BY p.supplier_id, s.name, m.product_id, p.barcode, p.name
  ),
  supplier_aggregated AS (
    SELECT 
      supplier_id,
      COALESCE(supplier_name, 'Sin proveedor') as supplier_name,
      SUM(total_quantity) as total_quantity,
      SUM(total_cost) as total_cost,
      COUNT(DISTINCT product_id) as product_count,
      SUM(movement_count) as movement_count
    FROM purchase_movements
    GROUP BY supplier_id, supplier_name
  ),
  totals AS (
    SELECT 
      SUM(total_quantity) as grand_total_quantity,
      SUM(total_cost) as grand_total_cost,
      COUNT(DISTINCT supplier_id) as supplier_count
    FROM supplier_aggregated
  ),
  supplier_with_calcs AS (
    SELECT 
      sa.supplier_name,
      sa.product_count,
      sa.total_quantity,
      sa.total_cost,
      sa.movement_count,
      COALESCE(ROUND(sa.total_cost / NULLIF(sa.total_quantity, 0), 2), 0) as avg_cost_per_unit,
      COALESCE(ROUND(sa.total_cost / NULLIF((SELECT grand_total_cost FROM totals), 0) * 100, 2), 0) as percent_of_total
    FROM supplier_aggregated sa
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Proveedores', 'value', COALESCE((SELECT supplier_count FROM totals), 0), 'format', 'number'),
      jsonb_build_object('label', 'Cantidad Total Comprada', 'value', COALESCE((SELECT grand_total_quantity FROM totals), 0), 'format', 'number'),
      jsonb_build_object('label', 'Costo Total de Compras', 'value', COALESCE((SELECT grand_total_cost FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Promedio por Proveedor', 'value', 
        COALESCE(ROUND((SELECT grand_total_cost FROM totals) / NULLIF((SELECT supplier_count FROM totals), 0), 2), 0), 'format', 'currency')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Costo de Compras por Proveedor',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', supplier_name, 'y', total_cost))
          FROM (
            SELECT supplier_name, total_cost
            FROM supplier_with_calcs
            ORDER BY total_cost DESC
            LIMIT 20
          ) top_suppliers
        )
      ),
      jsonb_build_object(
        'name', 'Cantidad Comprada por Proveedor',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', supplier_name, 'y', total_quantity))
          FROM (
            SELECT supplier_name, total_quantity
            FROM supplier_with_calcs
            ORDER BY total_quantity DESC
            LIMIT 20
          ) top_quantity
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'supplierName', supplier_name,
          'productCount', product_count,
          'totalQuantity', total_quantity,
          'totalCost', total_cost,
          'movementCount', movement_count,
          'avgCostPerUnit', avg_cost_per_unit,
          'percentOfTotal', percent_of_total
        )
      )
      FROM supplier_with_calcs
      ORDER BY total_cost DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'supplierName', 'label', 'Proveedor', 'type', 'string'),
        jsonb_build_object('key', 'productCount', 'label', 'Productos', 'type', 'number'),
        jsonb_build_object('key', 'totalQuantity', 'label', 'Cantidad Total', 'type', 'number'),
        jsonb_build_object('key', 'totalCost', 'label', 'Costo Total', 'type', 'currency'),
        jsonb_build_object('key', 'movementCount', 'label', 'Movimientos', 'type', 'number'),
        jsonb_build_object('key', 'avgCostPerUnit', 'label', 'Costo Promedio/Unidad', 'type', 'currency'),
        jsonb_build_object('key', 'percentOfTotal', 'label', '% del Total', 'type', 'percent')
      )
    )
  ) INTO result
  FROM totals;

  RETURN result;
END;
$$;
