-- ============================================================================
-- Analytics Reports Schema
-- ============================================================================
-- Crea un schema analytics con funciones RPC para reportes estructurados

CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- 1. REPORTE: Rotación de Inventario
-- ============================================================================
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
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Productos Analizados', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Total Vendido', 'value', SUM(sd.total_sold), 'format', 'number'),
      jsonb_build_object('label', 'Rotación Promedio', 'value', COALESCE(ROUND(AVG(sd.total_sold / NULLIF(st.current_stock, 0)), 2), 0), 'format', 'decimal')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Rotación por Producto',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', COALESCE(ROUND(total_sold / NULLIF(current_stock, 0), 2), 0)))
          FROM (
            SELECT sd.name, sd.total_sold, COALESCE(st.current_stock, 0) as current_stock
            FROM sales_data sd
            LEFT JOIN stock_data st ON sd.product_id = st.product_id
            ORDER BY sd.total_sold DESC
            LIMIT 20
          ) top_products
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'barcode', sd.barcode,
          'name', sd.name,
          'totalSold', sd.total_sold,
          'currentStock', COALESCE(st.current_stock, 0),
          'rotation', COALESCE(ROUND(sd.total_sold / NULLIF(st.current_stock, 0), 2), 0),
          'daysInventory', COALESCE(ROUND(365.0 / NULLIF(sd.total_sold / NULLIF(st.current_stock, 0), 0), 0), 0),
          'transactions', sd.transactions
        )
      )
      FROM sales_data sd
      LEFT JOIN stock_data st ON sd.product_id = st.product_id
      ORDER BY sd.total_sold DESC
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
  FROM sales_data sd
  LEFT JOIN stock_data st ON sd.product_id = st.product_id;

  RETURN result;
END;
$$;

-- ============================================================================
-- 2. REPORTE: Valorización de Inventario
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_inventory_valuation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  warehouse_filter text;
  category_filter uuid;
BEGIN
  -- Extraer filtros
  warehouse_filter := filters->>'warehouse_id';
  category_filter := (filters->>'category_id')::uuid;

  WITH stock_valuation AS (
    SELECT 
      p.id as product_id,
      p.barcode,
      p.name,
      COALESCE(c.name, 'Sin categoría') as category,
      SUM(s.quantity) as stock_qty,
      COALESCE(p.purchase_price, 0) as cost_price,
      p.price as sale_price,
      ROUND(SUM(s.quantity) * COALESCE(p.purchase_price, 0), 2) as cost_value,
      ROUND(SUM(s.quantity) * p.price, 2) as sale_value,
      ROUND(SUM(s.quantity) * (p.price - COALESCE(p.purchase_price, 0)), 2) as potential_margin
    FROM stock s
    INNER JOIN products p ON s.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.quantity > 0
      AND (warehouse_filter IS NULL OR s.warehouse_id = warehouse_filter)
      AND (category_filter IS NULL OR p.category_id = category_filter)
    GROUP BY p.id, p.barcode, p.name, c.name, p.purchase_price, p.price
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Valor Costo Total', 'value', COALESCE(SUM(cost_value), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Valor Venta Total', 'value', COALESCE(SUM(sale_value), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Potencial', 'value', COALESCE(SUM(potential_margin), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Productos en Stock', 'value', COUNT(*), 'format', 'number')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Valorización por Categoría (Top 10)',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', category_name, 'y', total_value))
          FROM (
            SELECT 
              category as category_name,
              SUM(sale_value) as total_value
            FROM stock_valuation
            GROUP BY category
            ORDER BY SUM(sale_value) DESC
            LIMIT 10
          ) cat_data
        )
      ),
      jsonb_build_object(
        'name', 'Margen Potencial por Categoría (Top 10)',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', category_name, 'y', total_margin))
          FROM (
            SELECT 
              category as category_name,
              SUM(potential_margin) as total_margin
            FROM stock_valuation
            GROUP BY category
            ORDER BY SUM(potential_margin) DESC
            LIMIT 10
          ) margin_data
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'barcode', barcode,
          'name', name,
          'category', category,
          'stockQty', stock_qty,
          'costPrice', cost_price,
          'salePrice', sale_price,
          'costValue', cost_value,
          'saleValue', sale_value,
          'potentialMargin', potential_margin
        )
      )
      FROM stock_valuation
      ORDER BY sale_value DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'Código', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'category', 'label', 'Categoría', 'type', 'string'),
        jsonb_build_object('key', 'stockQty', 'label', 'Cantidad', 'type', 'number'),
        jsonb_build_object('key', 'costPrice', 'label', 'Precio Costo', 'type', 'currency'),
        jsonb_build_object('key', 'salePrice', 'label', 'Precio Venta', 'type', 'currency'),
        jsonb_build_object('key', 'costValue', 'label', 'Valor Costo', 'type', 'currency'),
        jsonb_build_object('key', 'saleValue', 'label', 'Valor Venta', 'type', 'currency'),
        jsonb_build_object('key', 'potentialMargin', 'label', 'Margen Potencial', 'type', 'currency')
      )
    )
  ) INTO result
  FROM stock_valuation;

  RETURN result;
END;
$$;

-- ============================================================================
-- 3. REPORTE: Stock Bajo
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_low_stock(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- ============================================================================
-- 4. REPORTE: Timeline de Ventas
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_sales_timeline(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
BEGIN
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH daily_sales AS (
    SELECT 
      DATE_TRUNC('day', s.created_at) as sale_date,
      ROUND(SUM(s.total), 2) as total_revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as total_cost,
      COUNT(DISTINCT s.id) as sale_count
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    INNER JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY DATE_TRUNC('day', s.created_at)
  ),
  aggregated_data AS (
    SELECT 
      sale_date,
      total_revenue,
      total_cost,
      total_revenue - total_cost as gross_margin,
      COALESCE(ROUND((total_revenue - total_cost) / NULLIF(total_revenue, 0) * 100, 2), 0) as margin_pct,
      sale_count
    FROM daily_sales
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Ventas', 'value', COALESCE(SUM(sale_count), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', COALESCE(SUM(total_revenue), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Total', 'value', COALESCE(SUM(total_cost), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Bruta', 'value', COALESCE(SUM(gross_margin), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', 
        COALESCE(ROUND(AVG(margin_pct), 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Ingresos Diarios',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', TO_CHAR(sale_date, 'YYYY-MM-DD'), 'y', total_revenue))
          FROM aggregated_data
          ORDER BY sale_date
        )
      ),
      jsonb_build_object(
        'name', 'Margen Diario',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', TO_CHAR(sale_date, 'YYYY-MM-DD'), 'y', gross_margin))
          FROM aggregated_data
          ORDER BY sale_date
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', TO_CHAR(sale_date, 'YYYY-MM-DD'),
          'saleCount', sale_count,
          'totalRevenue', total_revenue,
          'totalCost', total_cost,
          'grossMargin', gross_margin,
          'marginPct', margin_pct
        )
      )
      FROM aggregated_data
      ORDER BY sale_date DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'date', 'label', 'Fecha', 'type', 'date'),
        jsonb_build_object('key', 'saleCount', 'label', 'Ventas', 'type', 'number'),
        jsonb_build_object('key', 'totalRevenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'totalCost', 'label', 'Costo', 'type', 'currency'),
        jsonb_build_object('key', 'grossMargin', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'marginPct', 'label', 'Margen %', 'type', 'percent')
      )
    )
  ) INTO result
  FROM aggregated_data;

  RETURN result;
END;
$$;

-- ============================================================================
-- 5. REPORTE: Ventas por Mes
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_sales_by_month(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
BEGIN
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('year', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH monthly_sales AS (
    SELECT 
      DATE_TRUNC('month', s.created_at) as sale_month,
      ROUND(SUM(s.total), 2) as total_revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as total_cost,
      COUNT(DISTINCT s.id) as sale_count
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    INNER JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY DATE_TRUNC('month', s.created_at)
  ),
  aggregated_data AS (
    SELECT 
      sale_month,
      total_revenue,
      total_cost,
      total_revenue - total_cost as gross_margin,
      COALESCE(ROUND((total_revenue - total_cost) / NULLIF(total_revenue, 0) * 100, 2), 0) as margin_pct,
      COALESCE(ROUND(total_revenue / NULLIF(sale_count, 0), 2), 0) as avg_ticket,
      sale_count
    FROM monthly_sales
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Ventas', 'value', COALESCE(SUM(sale_count), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', COALESCE(SUM(total_revenue), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Total', 'value', COALESCE(SUM(total_cost), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Bruta', 'value', COALESCE(SUM(gross_margin), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', 
        COALESCE(ROUND(AVG(margin_pct), 2), 0), 'format', 'percent'),
      jsonb_build_object('label', 'Ticket Promedio', 'value', 
        COALESCE(ROUND(AVG(avg_ticket), 2), 0), 'format', 'currency')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Ingresos Mensuales',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', TO_CHAR(sale_month, 'YYYY-MM'), 'y', total_revenue))
          FROM aggregated_data
          ORDER BY sale_month
        )
      ),
      jsonb_build_object(
        'name', 'Ganancia Mensual',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', TO_CHAR(sale_month, 'YYYY-MM'), 'y', gross_margin))
          FROM aggregated_data
          ORDER BY sale_month
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'month', TO_CHAR(sale_month, 'YYYY-MM'),
          'saleCount', sale_count,
          'totalRevenue', total_revenue,
          'totalCost', total_cost,
          'grossMargin', gross_margin,
          'marginPct', margin_pct,
          'avgTicket', avg_ticket
        )
      )
      FROM aggregated_data
      ORDER BY sale_month DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'month', 'label', 'Mes', 'type', 'string'),
        jsonb_build_object('key', 'saleCount', 'label', 'Ventas', 'type', 'number'),
        jsonb_build_object('key', 'totalRevenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'totalCost', 'label', 'Costo', 'type', 'currency'),
        jsonb_build_object('key', 'grossMargin', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'marginPct', 'label', 'Margen %', 'type', 'percent'),
        jsonb_build_object('key', 'avgTicket', 'label', 'Ticket Promedio', 'type', 'currency')
      )
    )
  ) INTO result
  FROM aggregated_data;

  RETURN result;
END;
$$;

-- ============================================================================
-- Permisos
-- ============================================================================
GRANT USAGE ON SCHEMA analytics TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO authenticated;

-- ============================================================================
-- 6. REPORTE: Ventas por Producto
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_sales_by_product(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
  category_filter text;
  product_filter text;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';
  category_filter := filters->>'category_id';
  product_filter := filters->>'product_id';

  WITH product_sales AS (
    SELECT 
      p.id as product_id,
      p.barcode,
      p.name,
      COALESCE(c.name, 'Sin categoría') as category,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(si.subtotal), 2) as revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as cost,
      COUNT(DISTINCT s.id) as transactions
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
      AND (category_filter IS NULL OR p.category_id = category_filter)
      AND (product_filter IS NULL OR p.id = product_filter)
    GROUP BY p.id, p.barcode, p.name, c.name
  ),
  aggregated_data AS (
    SELECT 
      product_id,
      barcode,
      name,
      category,
      quantity_sold,
      revenue,
      cost,
      revenue - cost as profit,
      COALESCE(ROUND((revenue - cost) / NULLIF(revenue, 0) * 100, 2), 0) as margin_pct,
      transactions
    FROM product_sales
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Productos Vendidos', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Unidades Vendidas', 'value', COALESCE(SUM(quantity_sold), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', COALESCE(SUM(revenue), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Total', 'value', COALESCE(SUM(cost), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Total', 'value', COALESCE(SUM(profit), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', 
        COALESCE(ROUND(AVG(margin_pct), 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Ingresos por Producto (Top 20)',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', revenue))
          FROM (
            SELECT name, revenue
            FROM aggregated_data
            ORDER BY revenue DESC
            LIMIT 20
          ) top_products
        )
      ),
      jsonb_build_object(
        'name', 'Margen por Producto (Top 20)',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', margin_pct))
          FROM (
            SELECT name, margin_pct
            FROM aggregated_data
            ORDER BY profit DESC
            LIMIT 20
          ) top_margin
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'barcode', barcode,
          'name', name,
          'category', category,
          'quantitySold', quantity_sold,
          'revenue', revenue,
          'cost', cost,
          'profit', profit,
          'marginPct', margin_pct,
          'transactions', transactions
        )
      )
      FROM aggregated_data
      ORDER BY revenue DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'Código', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'category', 'label', 'Categoría', 'type', 'string'),
        jsonb_build_object('key', 'quantitySold', 'label', 'Cantidad', 'type', 'number'),
        jsonb_build_object('key', 'revenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'cost', 'label', 'Costo', 'type', 'currency'),
        jsonb_build_object('key', 'profit', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'marginPct', 'label', 'Margen %', 'type', 'percent'),
        jsonb_build_object('key', 'transactions', 'label', 'Transacciones', 'type', 'number')
      )
    )
  ) INTO result
  FROM aggregated_data;

  RETURN result;
END;
$$;

-- ============================================================================
-- 7. REPORTE: Ventas por Categoría
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_sales_by_category(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
  category_filter text;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';
  category_filter := filters->>'category_id';

  WITH category_sales AS (
    SELECT 
      COALESCE(c.id, '00000000-0000-0000-0000-000000000000'::uuid) as category_id,
      COALESCE(c.name, 'Sin categoría') as category_name,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(si.subtotal), 2) as revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as cost,
      COUNT(DISTINCT s.id) as transactions,
      COUNT(DISTINCT p.id) as product_count
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
      AND (category_filter IS NULL OR c.id = category_filter)
    GROUP BY c.id, c.name
  ),
  aggregated_data AS (
    SELECT 
      category_id,
      category_name,
      quantity_sold,
      revenue,
      cost,
      revenue - cost as profit,
      COALESCE(ROUND((revenue - cost) / NULLIF(revenue, 0) * 100, 2), 0) as margin_pct,
      transactions,
      product_count
    FROM category_sales
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Categorías', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Unidades Vendidas', 'value', COALESCE(SUM(quantity_sold), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', COALESCE(SUM(revenue), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Total', 'value', COALESCE(SUM(cost), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Total', 'value', COALESCE(SUM(profit), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', 
        COALESCE(ROUND(AVG(margin_pct), 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Ingresos por Categoría',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', category_name, 'y', revenue))
          FROM aggregated_data
          ORDER BY revenue DESC
        )
      ),
      jsonb_build_object(
        'name', 'Ganancia por Categoría',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', category_name, 'y', profit))
          FROM aggregated_data
          ORDER BY profit DESC
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'categoryName', category_name,
          'productCount', product_count,
          'quantitySold', quantity_sold,
          'revenue', revenue,
          'cost', cost,
          'profit', profit,
          'marginPct', margin_pct,
          'transactions', transactions
        )
      )
      FROM aggregated_data
      ORDER BY revenue DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'categoryName', 'label', 'Categoría', 'type', 'string'),
        jsonb_build_object('key', 'productCount', 'label', 'Productos', 'type', 'number'),
        jsonb_build_object('key', 'quantitySold', 'label', 'Cantidad', 'type', 'number'),
        jsonb_build_object('key', 'revenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'cost', 'label', 'Costo', 'type', 'currency'),
        jsonb_build_object('key', 'profit', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'marginPct', 'label', 'Margen %', 'type', 'percent'),
        jsonb_build_object('key', 'transactions', 'label', 'Transacciones', 'type', 'number')
      )
    )
  ) INTO result
  FROM aggregated_data;

  RETURN result;
END;
$$;

-- ============================================================================
-- 8. REPORTE: Crédito vs Contado
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_credit_vs_cash(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH payment_type_sales AS (
    SELECT 
      s.sale_type,
      COUNT(DISTINCT s.id) as sale_count,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(s.total), 2) as revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as cost
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    INNER JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY s.sale_type
  ),
  aggregated_data AS (
    SELECT 
      sale_type,
      sale_count,
      quantity_sold,
      revenue,
      cost,
      revenue - cost as profit,
      COALESCE(ROUND((revenue - cost) / NULLIF(revenue, 0) * 100, 2), 0) as margin_pct,
      COALESCE(ROUND(revenue / NULLIF(sale_count, 0), 2), 0) as avg_ticket
    FROM payment_type_sales
  ),
  totals AS (
    SELECT 
      SUM(sale_count) as total_sales,
      SUM(revenue) as total_revenue
    FROM aggregated_data
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Ventas', 'value', COALESCE((SELECT total_sales FROM totals), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', COALESCE((SELECT total_revenue FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Ventas Contado', 'value', 
        COALESCE((SELECT sale_count FROM aggregated_data WHERE sale_type = 'CONTADO'), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ventas Crédito', 'value', 
        COALESCE((SELECT sale_count FROM aggregated_data WHERE sale_type = 'CREDITO'), 0), 'format', 'number'),
      jsonb_build_object('label', '% Contado', 'value', 
        COALESCE(ROUND((SELECT sale_count FROM aggregated_data WHERE sale_type = 'CONTADO') / 
          NULLIF((SELECT total_sales FROM totals), 0) * 100, 2), 0), 'format', 'percent'),
      jsonb_build_object('label', '% Crédito', 'value', 
        COALESCE(ROUND((SELECT sale_count FROM aggregated_data WHERE sale_type = 'CREDITO') / 
          NULLIF((SELECT total_sales FROM totals), 0) * 100, 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Ingresos por Tipo de Pago',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', sale_type, 'y', revenue))
          FROM aggregated_data
          ORDER BY revenue DESC
        )
      ),
      jsonb_build_object(
        'name', 'Volumen por Tipo de Pago',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', sale_type, 'y', sale_count))
          FROM aggregated_data
          ORDER BY sale_count DESC
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'saleType', sale_type,
          'saleCount', sale_count,
          'quantitySold', quantity_sold,
          'revenue', revenue,
          'cost', cost,
          'profit', profit,
          'marginPct', margin_pct,
          'avgTicket', avg_ticket,
          'percentOfTotal', COALESCE(ROUND(sale_count / NULLIF((SELECT total_sales FROM totals), 0) * 100, 2), 0)
        )
      )
      FROM aggregated_data
      ORDER BY revenue DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'saleType', 'label', 'Tipo de Pago', 'type', 'string'),
        jsonb_build_object('key', 'saleCount', 'label', 'Ventas', 'type', 'number'),
        jsonb_build_object('key', 'quantitySold', 'label', 'Unidades', 'type', 'number'),
        jsonb_build_object('key', 'revenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'cost', 'label', 'Costo', 'type', 'currency'),
        jsonb_build_object('key', 'profit', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'marginPct', 'label', 'Margen %', 'type', 'percent'),
        jsonb_build_object('key', 'avgTicket', 'label', 'Ticket Promedio', 'type', 'currency'),
        jsonb_build_object('key', 'percentOfTotal', 'label', '% del Total', 'type', 'percent')
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================================
-- 9. REPORTE: Resumen de Ventas
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_sales_summary(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH sales_summary AS (
    SELECT 
      COUNT(DISTINCT s.id) as total_sales,
      ROUND(SUM(s.total), 2) as total_revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as total_cost,
      SUM(si.quantity) as total_units_sold
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    INNER JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
  ),
  top_products AS (
    SELECT 
      p.id,
      p.barcode,
      p.name,
      COALESCE(c.name, 'Sin categoría') as category,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(si.subtotal), 2) as revenue,
      COUNT(DISTINCT s.id) as transactions
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY p.id, p.barcode, p.name, c.name
    ORDER BY SUM(si.quantity) DESC
    LIMIT 20
  ),
  summary_calcs AS (
    SELECT 
      total_sales,
      total_revenue,
      total_cost,
      total_revenue - total_cost as gross_margin,
      COALESCE(ROUND((total_revenue - total_cost) / NULLIF(total_revenue, 0) * 100, 2), 0) as margin_pct,
      COALESCE(ROUND(total_revenue / NULLIF(total_sales, 0), 2), 0) as avg_ticket,
      total_units_sold
    FROM sales_summary
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Ventas', 'value', COALESCE((SELECT total_sales FROM summary_calcs), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', COALESCE((SELECT total_revenue FROM summary_calcs), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Ticket Promedio', 'value', COALESCE((SELECT avg_ticket FROM summary_calcs), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Unidades Vendidas', 'value', COALESCE((SELECT total_units_sold FROM summary_calcs), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ganancia Bruta', 'value', COALESCE((SELECT gross_margin FROM summary_calcs), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', COALESCE((SELECT margin_pct FROM summary_calcs), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Top 20 Productos Más Vendidos',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', quantity_sold))
          FROM top_products
        )
      ),
      jsonb_build_object(
        'name', 'Top 20 Productos por Ingresos',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', revenue))
          FROM top_products
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'barcode', barcode,
          'name', name,
          'category', category,
          'quantitySold', quantity_sold,
          'revenue', revenue,
          'transactions', transactions
        )
      )
      FROM top_products
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'Código', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'category', 'label', 'Categoría', 'type', 'string'),
        jsonb_build_object('key', 'quantitySold', 'label', 'Cantidad Vendida', 'type', 'number'),
        jsonb_build_object('key', 'revenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'transactions', 'label', 'Transacciones', 'type', 'number')
      )
    )
  ) INTO result
  FROM summary_calcs;

  RETURN result;
END;
$$;

-- ============================================================================
-- 10. REPORTE: Ventas por Tienda
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_sales_by_store(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH store_sales AS (
    SELECT 
      s.store_id,
      COUNT(DISTINCT s.id) as sale_count,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(s.total), 2) as revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as cost,
      COUNT(DISTINCT s.client_id) as unique_clients
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    INNER JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY s.store_id
  ),
  aggregated_data AS (
    SELECT 
      store_id,
      sale_count,
      quantity_sold,
      revenue,
      cost,
      revenue - cost as profit,
      COALESCE(ROUND((revenue - cost) / NULLIF(revenue, 0) * 100, 2), 0) as margin_pct,
      COALESCE(ROUND(revenue / NULLIF(sale_count, 0), 2), 0) as avg_ticket,
      unique_clients
    FROM store_sales
  ),
  totals AS (
    SELECT 
      SUM(sale_count) as total_sales,
      SUM(revenue) as total_revenue,
      SUM(cost) as total_cost,
      SUM(profit) as total_profit
    FROM aggregated_data
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Tiendas', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Total Ventas', 'value', COALESCE((SELECT total_sales FROM totals), 0), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', COALESCE((SELECT total_revenue FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Total', 'value', COALESCE((SELECT total_cost FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Total', 'value', COALESCE((SELECT total_profit FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', 
        COALESCE(ROUND(AVG(margin_pct), 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Ingresos por Tienda',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', store_id, 'y', revenue))
          FROM aggregated_data
          ORDER BY revenue DESC
        )
      ),
      jsonb_build_object(
        'name', 'Ganancia por Tienda',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', store_id, 'y', profit))
          FROM aggregated_data
          ORDER BY profit DESC
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'storeId', store_id,
          'saleCount', sale_count,
          'quantitySold', quantity_sold,
          'revenue', revenue,
          'cost', cost,
          'profit', profit,
          'marginPct', margin_pct,
          'avgTicket', avg_ticket,
          'uniqueClients', unique_clients,
          'percentOfTotal', COALESCE(ROUND(revenue / NULLIF((SELECT total_revenue FROM totals), 0) * 100, 2), 0)
        )
      )
      FROM aggregated_data
      ORDER BY revenue DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'storeId', 'label', 'Tienda', 'type', 'string'),
        jsonb_build_object('key', 'saleCount', 'label', 'Ventas', 'type', 'number'),
        jsonb_build_object('key', 'quantitySold', 'label', 'Unidades', 'type', 'number'),
        jsonb_build_object('key', 'revenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'cost', 'label', 'Costo', 'type', 'currency'),
        jsonb_build_object('key', 'profit', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'marginPct', 'label', 'Margen %', 'type', 'percent'),
        jsonb_build_object('key', 'avgTicket', 'label', 'Ticket Promedio', 'type', 'currency'),
        jsonb_build_object('key', 'uniqueClients', 'label', 'Clientes Únicos', 'type', 'number'),
        jsonb_build_object('key', 'percentOfTotal', 'label', '% del Total', 'type', 'percent')
      )
    )
  ) INTO result
  FROM aggregated_data;

  RETURN result;
END;
$$;

-- ============================================================================
-- 11. REPORTE: Kardex de Movimientos
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_kardex(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- ============================================================================
-- 12. REPORTE: Compras por Proveedor
-- ============================================================================
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
      -- Calcular costo total usando purchase_price del producto
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
            FROM supplier_aggregated
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
            FROM supplier_aggregated
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
          'avgCostPerUnit', COALESCE(ROUND(total_cost / NULLIF(total_quantity, 0), 2), 0),
          'percentOfTotal', COALESCE(ROUND(total_cost / NULLIF((SELECT grand_total_cost FROM totals), 0) * 100, 2), 0)
        )
      )
      FROM supplier_aggregated
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

-- ============================================================================
-- 13. REPORTE: Compras por Período
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_purchases_by_period(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  supplier_filter uuid;
  period_type text;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '90 days');
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  supplier_filter := (filters->>'supplier_id')::uuid;
  -- Determinar tipo de período basado en rango de fechas
  -- Si es menos de 31 días: diario, si es menos de 180 días: semanal, sino: mensual
  period_type := CASE 
    WHEN end_date - start_date <= INTERVAL '31 days' THEN 'day'
    WHEN end_date - start_date <= INTERVAL '180 days' THEN 'week'
    ELSE 'month'
  END;

  WITH purchase_movements AS (
    SELECT 
      m.created_at,
      DATE_TRUNC(period_type, m.created_at) as period_date,
      p.supplier_id,
      s.name as supplier_name,
      m.product_id,
      p.barcode,
      p.name as product_name,
      m.quantity,
      COALESCE(p.purchase_price, 0) as unit_cost,
      ROUND(m.quantity * COALESCE(p.purchase_price, 0), 2) as total_cost
    FROM movements m
    INNER JOIN products p ON m.product_id = p.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE m.type = 'ENTRADA'
      AND m.created_at >= start_date
      AND m.created_at <= end_date
      AND (supplier_filter IS NULL OR p.supplier_id = supplier_filter)
  ),
  period_aggregated AS (
    SELECT 
      period_date,
      SUM(quantity) as total_quantity,
      SUM(total_cost) as total_cost,
      COUNT(DISTINCT product_id) as product_count,
      COUNT(DISTINCT supplier_id) as supplier_count,
      COUNT(*) as movement_count
    FROM purchase_movements
    GROUP BY period_date
  ),
  totals AS (
    SELECT 
      SUM(total_quantity) as grand_total_quantity,
      SUM(total_cost) as grand_total_cost,
      COUNT(DISTINCT period_date) as period_count
    FROM period_aggregated
  ),
  -- Calcular tendencia (comparar primera mitad vs segunda mitad del período)
  trend_calc AS (
    SELECT 
      AVG(CASE WHEN period_date < start_date + (end_date - start_date) / 2 THEN total_cost ELSE NULL END) as first_half_avg,
      AVG(CASE WHEN period_date >= start_date + (end_date - start_date) / 2 THEN total_cost ELSE NULL END) as second_half_avg
    FROM period_aggregated
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Períodos Analizados', 'value', COALESCE((SELECT period_count FROM totals), 0), 'format', 'number'),
      jsonb_build_object('label', 'Cantidad Total Comprada', 'value', COALESCE((SELECT grand_total_quantity FROM totals), 0), 'format', 'number'),
      jsonb_build_object('label', 'Costo Total de Compras', 'value', COALESCE((SELECT grand_total_cost FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Promedio por Período', 'value', 
        COALESCE(ROUND((SELECT grand_total_cost FROM totals) / NULLIF((SELECT period_count FROM totals), 0), 2), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Tendencia', 'value', 
        COALESCE(ROUND(((SELECT second_half_avg FROM trend_calc) - (SELECT first_half_avg FROM trend_calc)) / NULLIF((SELECT first_half_avg FROM trend_calc), 0) * 100, 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Costo de Compras por Período',
        'points', (
          SELECT jsonb_agg(jsonb_build_object(
            'x', TO_CHAR(period_date, CASE 
              WHEN period_type = 'day' THEN 'YYYY-MM-DD'
              WHEN period_type = 'week' THEN 'YYYY-"W"IW'
              ELSE 'YYYY-MM'
            END), 
            'y', total_cost
          ))
          FROM period_aggregated
          ORDER BY period_date
        )
      ),
      jsonb_build_object(
        'name', 'Cantidad Comprada por Período',
        'points', (
          SELECT jsonb_agg(jsonb_build_object(
            'x', TO_CHAR(period_date, CASE 
              WHEN period_type = 'day' THEN 'YYYY-MM-DD'
              WHEN period_type = 'week' THEN 'YYYY-"W"IW'
              ELSE 'YYYY-MM'
            END), 
            'y', total_quantity
          ))
          FROM period_aggregated
          ORDER BY period_date
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'period', TO_CHAR(period_date, CASE 
            WHEN period_type = 'day' THEN 'YYYY-MM-DD'
            WHEN period_type = 'week' THEN 'YYYY-"W"IW'
            ELSE 'YYYY-MM'
          END),
          'periodType', period_type,
          'totalQuantity', total_quantity,
          'totalCost', total_cost,
          'productCount', product_count,
          'supplierCount', supplier_count,
          'movementCount', movement_count,
          'avgCostPerUnit', COALESCE(ROUND(total_cost / NULLIF(total_quantity, 0), 2), 0)
        )
      )
      FROM period_aggregated
      ORDER BY period_date DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'period', 'label', 'Período', 'type', 'string'),
        jsonb_build_object('key', 'periodType', 'label', 'Tipo', 'type', 'string'),
        jsonb_build_object('key', 'totalQuantity', 'label', 'Cantidad Total', 'type', 'number'),
        jsonb_build_object('key', 'totalCost', 'label', 'Costo Total', 'type', 'currency'),
        jsonb_build_object('key', 'productCount', 'label', 'Productos', 'type', 'number'),
        jsonb_build_object('key', 'supplierCount', 'label', 'Proveedores', 'type', 'number'),
        jsonb_build_object('key', 'movementCount', 'label', 'Movimientos', 'type', 'number'),
        jsonb_build_object('key', 'avgCostPerUnit', 'label', 'Costo Promedio/Unidad', 'type', 'currency')
      )
    )
  ) INTO result
  FROM totals, trend_calc;

  RETURN result;
END;
$$;


-- ============================================================================
-- 14. REPORTE: Clientes con Deuda
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_clients_debt(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '365 days');
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());

  WITH client_debt_data AS (
    SELECT 
      c.id as client_id,
      c.dni,
      c.name as client_name,
      c.phone,
      c.credit_limit,
      c.credit_used,
      -- Calcular deuda total: suma de cuotas - suma de pagos
      COALESCE(SUM(i.amount), 0) as total_installments,
      COALESCE(SUM(i.paid_amount), 0) as total_paid,
      COALESCE(SUM(i.amount) - SUM(i.paid_amount), 0) as debt_balance,
      -- Contar cuotas pendientes y vencidas
      COUNT(i.id) FILTER (WHERE i.status IN ('PENDING', 'PARTIAL')) as pending_installments,
      COUNT(i.id) FILTER (WHERE i.status = 'OVERDUE') as overdue_installments,
      -- Calcular utilización de crédito
      COALESCE(ROUND(c.credit_used / NULLIF(c.credit_limit, 0) * 100, 2), 0) as credit_utilization_pct,
      -- Fecha de última cuota vencida
      MAX(i.due_date) FILTER (WHERE i.status = 'OVERDUE') as last_overdue_date,
      -- Contar planes de crédito activos
      COUNT(DISTINCT cp.id) as active_credit_plans
    FROM clients c
    LEFT JOIN credit_plans cp ON c.id = cp.client_id 
      AND cp.status = 'ACTIVE'
      AND cp.created_at >= start_date
      AND cp.created_at <= end_date
    LEFT JOIN installments i ON cp.id = i.plan_id
    WHERE c.active = true
    GROUP BY c.id, c.dni, c.name, c.phone, c.credit_limit, c.credit_used
    -- Filtrar solo clientes con deuda pendiente
    HAVING COALESCE(SUM(i.amount) - SUM(i.paid_amount), 0) > 0
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_clients_with_debt,
      SUM(debt_balance) as total_debt,
      SUM(total_installments) as total_installments_amount,
      SUM(total_paid) as total_paid_amount,
      AVG(debt_balance) as avg_debt_per_client,
      SUM(credit_used) as total_credit_used,
      SUM(credit_limit) as total_credit_limit,
      COUNT(*) FILTER (WHERE overdue_installments > 0) as clients_with_overdue
    FROM client_debt_data
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Clientes con Deuda', 'value', COALESCE((SELECT total_clients_with_debt FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Deuda Total', 'value', COALESCE((SELECT total_debt FROM summary_stats), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Deuda Promedio', 'value', COALESCE((SELECT ROUND(avg_debt_per_client, 2) FROM summary_stats), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Total Pagado', 'value', COALESCE((SELECT total_paid_amount FROM summary_stats), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Clientes con Cuotas Vencidas', 'value', COALESCE((SELECT clients_with_overdue FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Utilización de Crédito Total', 'value', 
        COALESCE(ROUND((SELECT total_credit_used FROM summary_stats) / NULLIF((SELECT total_credit_limit FROM summary_stats), 0) * 100, 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Top 20 Clientes por Deuda',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', client_name, 'y', debt_balance))
          FROM (
            SELECT client_name, debt_balance
            FROM client_debt_data
            ORDER BY debt_balance DESC
            LIMIT 20
          ) top_debtors
        )
      ),
      jsonb_build_object(
        'name', 'Utilización de Crédito por Cliente (Top 20)',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', client_name, 'y', credit_utilization_pct))
          FROM (
            SELECT client_name, credit_utilization_pct
            FROM client_debt_data
            WHERE credit_limit > 0
            ORDER BY credit_utilization_pct DESC
            LIMIT 20
          ) top_utilization
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'dni', COALESCE(dni, 'Sin DNI'),
          'clientName', client_name,
          'phone', COALESCE(phone, ''),
          'creditLimit', credit_limit,
          'creditUsed', credit_used,
          'creditUtilizationPct', credit_utilization_pct,
          'totalInstallments', total_installments,
          'totalPaid', total_paid,
          'debtBalance', debt_balance,
          'pendingInstallments', pending_installments,
          'overdueInstallments', overdue_installments,
          'activeCreditPlans', active_credit_plans,
          'lastOverdueDate', COALESCE(TO_CHAR(last_overdue_date, 'YYYY-MM-DD'), ''),
          'daysOverdue', CASE 
            WHEN last_overdue_date IS NOT NULL THEN GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - last_overdue_date))::INTEGER)
            ELSE 0
          END
        )
      )
      FROM client_debt_data
      ORDER BY debt_balance DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'dni', 'label', 'DNI', 'type', 'string'),
        jsonb_build_object('key', 'clientName', 'label', 'Cliente', 'type', 'string'),
        jsonb_build_object('key', 'phone', 'label', 'Teléfono', 'type', 'string'),
        jsonb_build_object('key', 'creditLimit', 'label', 'Límite de Crédito', 'type', 'currency'),
        jsonb_build_object('key', 'creditUsed', 'label', 'Crédito Usado', 'type', 'currency'),
        jsonb_build_object('key', 'creditUtilizationPct', 'label', 'Utilización %', 'type', 'percent'),
        jsonb_build_object('key', 'totalInstallments', 'label', 'Total Cuotas', 'type', 'currency'),
        jsonb_build_object('key', 'totalPaid', 'label', 'Total Pagado', 'type', 'currency'),
        jsonb_build_object('key', 'debtBalance', 'label', 'Saldo Deuda', 'type', 'currency'),
        jsonb_build_object('key', 'pendingInstallments', 'label', 'Cuotas Pendientes', 'type', 'number'),
        jsonb_build_object('key', 'overdueInstallments', 'label', 'Cuotas Vencidas', 'type', 'number'),
        jsonb_build_object('key', 'activeCreditPlans', 'label', 'Planes Activos', 'type', 'number'),
        jsonb_build_object('key', 'lastOverdueDate', 'label', 'Última Fecha Vencida', 'type', 'date'),
        jsonb_build_object('key', 'daysOverdue', 'label', 'Días de Atraso', 'type', 'number')
      )
    )
  ) INTO result
  FROM summary_stats;

  RETURN result;
END;
$$;

-- ============================================================================
-- PUBLIC SCHEMA WRAPPERS
-- ============================================================================
-- These wrapper functions expose the analytics schema functions through the
-- public schema so they can be called via Supabase RPC API

CREATE OR REPLACE FUNCTION public.report_sales_timeline(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_timeline(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_timeline TO authenticated;


-- ============================================================================
-- 15. REPORTE: Cuotas Vencidas
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_overdue_installments(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '365 days');
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());

  WITH overdue_data AS (
    SELECT 
      i.id as installment_id,
      i.installment_number,
      i.due_date,
      i.amount,
      i.paid_amount,
      i.amount - i.paid_amount as balance,
      i.status,
      EXTRACT(DAY FROM (CURRENT_DATE - i.due_date))::INTEGER as days_overdue,
      cp.id as plan_id,
      cp.total_amount as plan_total,
      c.id as client_id,
      c.dni,
      c.name as client_name,
      c.phone,
      c.credit_limit,
      c.credit_used,
      s.id as sale_id,
      s.total as sale_total
    FROM installments i
    INNER JOIN credit_plans cp ON i.plan_id = cp.id
    INNER JOIN clients c ON cp.client_id = c.id
    LEFT JOIN sales s ON cp.sale_id = s.id
    WHERE i.due_date < CURRENT_DATE
      AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
      AND i.due_date >= start_date
      AND i.due_date <= end_date
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_overdue_installments,
      SUM(balance) as total_overdue_amount,
      AVG(balance) as avg_overdue_amount,
      COUNT(DISTINCT client_id) as clients_with_overdue,
      AVG(days_overdue) as avg_days_overdue,
      MAX(days_overdue) as max_days_overdue,
      COUNT(*) FILTER (WHERE days_overdue > 30) as critical_overdue_count,
      SUM(balance) FILTER (WHERE days_overdue > 30) as critical_overdue_amount
    FROM overdue_data
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Cuotas Vencidas', 'value', COALESCE((SELECT total_overdue_installments FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Monto Total Vencido', 'value', COALESCE((SELECT total_overdue_amount FROM summary_stats), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Monto Promedio Vencido', 'value', COALESCE((SELECT ROUND(avg_overdue_amount, 2) FROM summary_stats), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Clientes con Cuotas Vencidas', 'value', COALESCE((SELECT clients_with_overdue FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Días Promedio de Atraso', 'value', COALESCE((SELECT ROUND(avg_days_overdue, 0) FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Cuotas Críticas (>30 días)', 'value', COALESCE((SELECT critical_overdue_count FROM summary_stats), 0), 'format', 'number')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Top 20 Clientes por Monto Vencido',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', client_name, 'y', total_balance))
          FROM (
            SELECT 
              client_name,
              SUM(balance) as total_balance
            FROM overdue_data
            GROUP BY client_id, client_name
            ORDER BY SUM(balance) DESC
            LIMIT 20
          ) top_clients
        )
      ),
      jsonb_build_object(
        'name', 'Distribución por Días de Atraso',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', range_label, 'y', count))
          FROM (
            SELECT 
              CASE 
                WHEN days_overdue <= 7 THEN '1-7 días'
                WHEN days_overdue <= 15 THEN '8-15 días'
                WHEN days_overdue <= 30 THEN '16-30 días'
                WHEN days_overdue <= 60 THEN '31-60 días'
                ELSE 'Más de 60 días'
              END as range_label,
              COUNT(*) as count
            FROM overdue_data
            GROUP BY 
              CASE 
                WHEN days_overdue <= 7 THEN '1-7 días'
                WHEN days_overdue <= 15 THEN '8-15 días'
                WHEN days_overdue <= 30 THEN '16-30 días'
                WHEN days_overdue <= 60 THEN '31-60 días'
                ELSE 'Más de 60 días'
              END
            ORDER BY MIN(days_overdue)
          ) ranges
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'dni', COALESCE(dni, 'Sin DNI'),
          'clientName', client_name,
          'phone', COALESCE(phone, ''),
          'installmentNumber', installment_number,
          'dueDate', TO_CHAR(due_date, 'YYYY-MM-DD'),
          'amount', amount,
          'paidAmount', paid_amount,
          'balance', balance,
          'daysOverdue', days_overdue,
          'status', status,
          'creditLimit', credit_limit,
          'creditUsed', credit_used,
          'saleTotal', COALESCE(sale_total, 0),
          'severity', CASE 
            WHEN days_overdue > 60 THEN 'CRÍTICO'
            WHEN days_overdue > 30 THEN 'ALTO'
            WHEN days_overdue > 15 THEN 'MEDIO'
            ELSE 'BAJO'
          END
        )
      )
      FROM overdue_data
      ORDER BY days_overdue DESC, balance DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'dni', 'label', 'DNI', 'type', 'string'),
        jsonb_build_object('key', 'clientName', 'label', 'Cliente', 'type', 'string'),
        jsonb_build_object('key', 'phone', 'label', 'Teléfono', 'type', 'string'),
        jsonb_build_object('key', 'installmentNumber', 'label', 'Cuota #', 'type', 'number'),
        jsonb_build_object('key', 'dueDate', 'label', 'Fecha Vencimiento', 'type', 'date'),
        jsonb_build_object('key', 'amount', 'label', 'Monto', 'type', 'currency'),
        jsonb_build_object('key', 'paidAmount', 'label', 'Pagado', 'type', 'currency'),
        jsonb_build_object('key', 'balance', 'label', 'Saldo', 'type', 'currency'),
        jsonb_build_object('key', 'daysOverdue', 'label', 'Días Atraso', 'type', 'number'),
        jsonb_build_object('key', 'status', 'label', 'Estado', 'type', 'string'),
        jsonb_build_object('key', 'severity', 'label', 'Severidad', 'type', 'string')
      )
    )
  ) INTO result
  FROM summary_stats;

  RETURN result;
END;
$$;

-- ============================================================================
-- 16. REPORTE: Efectividad de Cobranza
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_collection_effectiveness(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());

  WITH collection_data AS (
    SELECT 
      DATE_TRUNC('month', i.due_date) as period,
      -- Monto esperado: suma de todas las cuotas que vencieron en el período
      SUM(i.amount) as expected_amount,
      -- Monto cobrado: suma de pagos realizados para cuotas que vencieron en el período
      SUM(i.paid_amount) as collected_amount,
      -- Monto pendiente
      SUM(i.amount - i.paid_amount) as pending_amount,
      -- Contar cuotas
      COUNT(*) as total_installments,
      COUNT(*) FILTER (WHERE i.status = 'PAID') as paid_installments,
      COUNT(*) FILTER (WHERE i.status IN ('PENDING', 'PARTIAL')) as pending_installments,
      COUNT(*) FILTER (WHERE i.status = 'OVERDUE') as overdue_installments
    FROM installments i
    WHERE i.due_date >= start_date
      AND i.due_date <= end_date
    GROUP BY DATE_TRUNC('month', i.due_date)
  ),
  aggregated_data AS (
    SELECT 
      period,
      expected_amount,
      collected_amount,
      pending_amount,
      total_installments,
      paid_installments,
      pending_installments,
      overdue_installments,
      -- Calcular efectividad de cobranza
      COALESCE(ROUND(collected_amount / NULLIF(expected_amount, 0) * 100, 2), 0) as effectiveness_pct,
      -- Calcular tasa de pago
      COALESCE(ROUND(paid_installments::numeric / NULLIF(total_installments, 0) * 100, 2), 0) as payment_rate_pct
    FROM collection_data
  ),
  totals AS (
    SELECT 
      SUM(expected_amount) as total_expected,
      SUM(collected_amount) as total_collected,
      SUM(pending_amount) as total_pending,
      SUM(total_installments) as total_installments_count,
      SUM(paid_installments) as total_paid_count,
      SUM(pending_installments) as total_pending_count,
      SUM(overdue_installments) as total_overdue_count
    FROM aggregated_data
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Monto Esperado', 'value', COALESCE((SELECT total_expected FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Monto Cobrado', 'value', COALESCE((SELECT total_collected FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Monto Pendiente', 'value', COALESCE((SELECT total_pending FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Efectividad de Cobranza', 'value', 
        COALESCE(ROUND((SELECT total_collected FROM totals) / NULLIF((SELECT total_expected FROM totals), 0) * 100, 2), 0), 'format', 'percent'),
      jsonb_build_object('label', 'Cuotas Pagadas', 'value', COALESCE((SELECT total_paid_count FROM totals), 0), 'format', 'number'),
      jsonb_build_object('label', 'Tasa de Pago', 'value', 
        COALESCE(ROUND((SELECT total_paid_count FROM totals)::numeric / NULLIF((SELECT total_installments_count FROM totals), 0) * 100, 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Efectividad de Cobranza por Mes',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', TO_CHAR(period, 'YYYY-MM'), 'y', effectiveness_pct))
          FROM aggregated_data
          ORDER BY period
        )
      ),
      jsonb_build_object(
        'name', 'Monto Esperado vs Cobrado',
        'points', (
          SELECT jsonb_agg(jsonb_build_object(
            'x', TO_CHAR(period, 'YYYY-MM'), 
            'expected', expected_amount,
            'collected', collected_amount
          ))
          FROM aggregated_data
          ORDER BY period
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'period', TO_CHAR(period, 'YYYY-MM'),
          'expectedAmount', expected_amount,
          'collectedAmount', collected_amount,
          'pendingAmount', pending_amount,
          'effectivenessPct', effectiveness_pct,
          'totalInstallments', total_installments,
          'paidInstallments', paid_installments,
          'pendingInstallments', pending_installments,
          'overdueInstallments', overdue_installments,
          'paymentRatePct', payment_rate_pct
        )
      )
      FROM aggregated_data
      ORDER BY period DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'period', 'label', 'Período', 'type', 'string'),
        jsonb_build_object('key', 'expectedAmount', 'label', 'Monto Esperado', 'type', 'currency'),
        jsonb_build_object('key', 'collectedAmount', 'label', 'Monto Cobrado', 'type', 'currency'),
        jsonb_build_object('key', 'pendingAmount', 'label', 'Monto Pendiente', 'type', 'currency'),
        jsonb_build_object('key', 'effectivenessPct', 'label', 'Efectividad %', 'type', 'percent'),
        jsonb_build_object('key', 'totalInstallments', 'label', 'Total Cuotas', 'type', 'number'),
        jsonb_build_object('key', 'paidInstallments', 'label', 'Cuotas Pagadas', 'type', 'number'),
        jsonb_build_object('key', 'pendingInstallments', 'label', 'Cuotas Pendientes', 'type', 'number'),
        jsonb_build_object('key', 'overdueInstallments', 'label', 'Cuotas Vencidas', 'type', 'number'),
        jsonb_build_object('key', 'paymentRatePct', 'label', 'Tasa de Pago %', 'type', 'percent')
      )
    )
  ) INTO result
  FROM totals;

  RETURN result;
END;
$$;

-- ============================================================================
-- 17. REPORTE: Margen de Ganancia
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_profit_margin(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
  category_filter uuid;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';
  category_filter := (filters->>'category_id')::uuid;

  WITH margin_data AS (
    SELECT 
      p.id,
      p.barcode,
      p.name,
      COALESCE(c.name, 'Sin categoría') as category,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(si.subtotal), 2) as revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as cost,
      ROUND(SUM(si.subtotal) - SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as gross_profit,
      COALESCE(
        ROUND(
          (SUM(si.subtotal) - SUM(si.quantity * COALESCE(p.purchase_price, 0))) 
          / NULLIF(SUM(si.subtotal), 0) * 100, 
          2
        ), 
        0
      ) as margin_pct
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
      AND (category_filter IS NULL OR p.category_id = category_filter)
    GROUP BY p.id, p.barcode, p.name, c.name
  ),
  category_summary AS (
    SELECT 
      category,
      SUM(quantity_sold) as category_quantity,
      SUM(revenue) as category_revenue,
      SUM(cost) as category_cost,
      SUM(gross_profit) as category_profit,
      COALESCE(ROUND(SUM(gross_profit) / NULLIF(SUM(revenue), 0) * 100, 2), 0) as category_margin_pct,
      COUNT(*) as product_count
    FROM margin_data
    GROUP BY category
  ),
  totals AS (
    SELECT 
      SUM(revenue) as total_revenue,
      SUM(cost) as total_cost,
      SUM(gross_profit) as total_profit,
      COUNT(*) as product_count
    FROM margin_data
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Ingresos Totales', 'value', COALESCE((SELECT total_revenue FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Total', 'value', COALESCE((SELECT total_cost FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Bruta', 'value', COALESCE((SELECT total_profit FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', 
        COALESCE(ROUND((SELECT total_profit FROM totals) / NULLIF((SELECT total_revenue FROM totals), 0) * 100, 2), 0), 'format', 'percent'),
      jsonb_build_object('label', 'Productos Analizados', 'value', COALESCE((SELECT product_count FROM totals), 0), 'format', 'number')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Margen por Producto (Top 20)',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', margin_pct))
          FROM (
            SELECT name, margin_pct
            FROM margin_data
            ORDER BY gross_profit DESC
            LIMIT 20
          ) top_margin
        )
      ),
      jsonb_build_object(
        'name', 'Ganancia por Categoría',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', category, 'y', category_profit))
          FROM category_summary
          ORDER BY category_profit DESC
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'barcode', barcode,
          'name', name,
          'category', category,
          'quantitySold', quantity_sold,
          'revenue', revenue,
          'cost', cost,
          'grossProfit', gross_profit,
          'marginPct', margin_pct
        )
      )
      FROM margin_data
      ORDER BY gross_profit DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'Código', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'category', 'label', 'Categoría', 'type', 'string'),
        jsonb_build_object('key', 'quantitySold', 'label', 'Cantidad', 'type', 'number'),
        jsonb_build_object('key', 'revenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'cost', 'label', 'Costo', 'type', 'currency'),
        jsonb_build_object('key', 'grossProfit', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'marginPct', 'label', 'Margen %', 'type', 'percent')
      )
    )
  ) INTO result
  FROM totals;

  RETURN result;
END;
$$;

-- ============================================================================
-- 18. REPORTE: Flujo de Caja
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_cash_flow(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH cash_inflows AS (
    -- Ventas al contado
    SELECT 
      DATE_TRUNC('day', created_at) as flow_date,
      'Ventas Contado' as concept,
      'INGRESO' as type,
      ROUND(SUM(total), 2) as amount
    FROM sales
    WHERE voided = false
      AND sale_type = 'CONTADO'
      AND created_at >= start_date
      AND created_at <= end_date
      AND (store_filter IS NULL OR store_id = store_filter)
    GROUP BY DATE_TRUNC('day', created_at)
    
    UNION ALL
    
    -- Pagos de crédito
    SELECT 
      DATE_TRUNC('day', p.created_at) as flow_date,
      'Pagos Crédito' as concept,
      'INGRESO' as type,
      ROUND(SUM(p.amount), 2) as amount
    FROM payments p
    INNER JOIN installments i ON p.installment_id = i.id
    INNER JOIN credit_plans cp ON i.plan_id = cp.id
    INNER JOIN sales s ON cp.sale_id = s.id
    WHERE p.created_at >= start_date
      AND p.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY DATE_TRUNC('day', p.created_at)
  ),
  cash_outflows AS (
    -- Gastos de caja
    SELECT 
      DATE_TRUNC('day', ce.created_at) as flow_date,
      COALESCE(ce.description, 'Gasto') as concept,
      'EGRESO' as type,
      ROUND(SUM(ce.amount), 2) as amount
    FROM cash_expenses ce
    INNER JOIN cash_shifts cs ON ce.shift_id = cs.id
    WHERE ce.created_at >= start_date
      AND ce.created_at <= end_date
      AND (store_filter IS NULL OR cs.store_id = store_filter)
    GROUP BY DATE_TRUNC('day', ce.created_at), ce.description
  ),
  combined_flow AS (
    SELECT flow_date, concept, type, amount FROM cash_inflows
    UNION ALL
    SELECT flow_date, concept, type, -amount as amount FROM cash_outflows
  ),
  daily_summary AS (
    SELECT 
      flow_date,
      SUM(amount) FILTER (WHERE type = 'INGRESO') as daily_income,
      SUM(amount) FILTER (WHERE type = 'EGRESO') as daily_expenses,
      SUM(amount) as daily_net_flow
    FROM combined_flow
    GROUP BY flow_date
  ),
  totals AS (
    SELECT 
      SUM(amount) FILTER (WHERE type = 'INGRESO') as total_income,
      ABS(SUM(amount) FILTER (WHERE type = 'EGRESO')) as total_expenses,
      SUM(amount) as net_cash_flow
    FROM combined_flow
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Ingresos', 'value', COALESCE((SELECT total_income FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Total Egresos', 'value', COALESCE((SELECT total_expenses FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Flujo Neto', 'value', COALESCE((SELECT net_cash_flow FROM totals), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Promedio Diario Ingresos', 'value', 
        COALESCE(ROUND((SELECT total_income FROM totals) / NULLIF(EXTRACT(DAY FROM (end_date - start_date))::numeric, 0), 2), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Promedio Diario Egresos', 'value', 
        COALESCE(ROUND((SELECT total_expenses FROM totals) / NULLIF(EXTRACT(DAY FROM (end_date - start_date))::numeric, 0), 2), 0), 'format', 'currency')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Flujo Neto Diario',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', TO_CHAR(flow_date, 'YYYY-MM-DD'), 'y', daily_net_flow))
          FROM daily_summary
          ORDER BY flow_date
        )
      ),
      jsonb_build_object(
        'name', 'Ingresos vs Egresos',
        'points', (
          SELECT jsonb_agg(jsonb_build_object(
            'x', TO_CHAR(flow_date, 'YYYY-MM-DD'), 
            'income', COALESCE(daily_income, 0),
            'expenses', ABS(COALESCE(daily_expenses, 0))
          ))
          FROM daily_summary
          ORDER BY flow_date
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', TO_CHAR(flow_date, 'YYYY-MM-DD'),
          'concept', concept,
          'type', type,
          'amount', ABS(amount)
        )
      )
      FROM combined_flow
      ORDER BY flow_date DESC, type, concept
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'date', 'label', 'Fecha', 'type', 'date'),
        jsonb_build_object('key', 'concept', 'label', 'Concepto', 'type', 'string'),
        jsonb_build_object('key', 'type', 'label', 'Tipo', 'type', 'string'),
        jsonb_build_object('key', 'amount', 'label', 'Monto', 'type', 'currency')
      )
    )
  ) INTO result
  FROM totals;

  RETURN result;
END;
$$;

-- ============================================================================
-- Grant permissions for new functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION analytics.report_overdue_installments TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.report_collection_effectiveness TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.report_profit_margin TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.report_cash_flow TO authenticated;


-- ============================================================================
-- PUBLIC SCHEMA WRAPPERS FOR ALL ANALYTICS FUNCTIONS
-- ============================================================================
-- These wrapper functions expose all analytics schema functions through the
-- public schema so they can be called via Supabase RPC API

-- 1. Inventory Rotation
CREATE OR REPLACE FUNCTION public.report_inventory_rotation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_inventory_rotation(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_inventory_rotation TO authenticated;

-- 2. Inventory Valuation
CREATE OR REPLACE FUNCTION public.report_inventory_valuation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_inventory_valuation(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_inventory_valuation TO authenticated;

-- 3. Low Stock
CREATE OR REPLACE FUNCTION public.report_low_stock(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_low_stock(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_low_stock TO authenticated;

-- 4. Sales Timeline (already exists, but ensuring it's here)
CREATE OR REPLACE FUNCTION public.report_sales_timeline(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_timeline(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_timeline TO authenticated;

-- 5. Sales by Month
CREATE OR REPLACE FUNCTION public.report_sales_by_month(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_by_month(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_month TO authenticated;

-- 6. Sales by Product
CREATE OR REPLACE FUNCTION public.report_sales_by_product(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_by_product(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_product TO authenticated;

-- 7. Sales by Category
CREATE OR REPLACE FUNCTION public.report_sales_by_category(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_by_category(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_category TO authenticated;

-- 8. Credit vs Cash
CREATE OR REPLACE FUNCTION public.report_credit_vs_cash(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_credit_vs_cash(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_credit_vs_cash TO authenticated;

-- 9. Sales Summary
CREATE OR REPLACE FUNCTION public.report_sales_summary(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_summary(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_summary TO authenticated;

-- 10. Sales by Store
CREATE OR REPLACE FUNCTION public.report_sales_by_store(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_by_store(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_store TO authenticated;

-- 11. Kardex
CREATE OR REPLACE FUNCTION public.report_kardex(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_kardex(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_kardex TO authenticated;

-- 12. Purchases by Supplier
CREATE OR REPLACE FUNCTION public.report_purchases_by_supplier(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_purchases_by_supplier(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_purchases_by_supplier TO authenticated;

-- 13. Purchases by Period
CREATE OR REPLACE FUNCTION public.report_purchases_by_period(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_purchases_by_period(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_purchases_by_period TO authenticated;

-- 14. Clients Debt
CREATE OR REPLACE FUNCTION public.report_clients_debt(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_clients_debt(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_clients_debt TO authenticated;

-- 15. Overdue Installments
CREATE OR REPLACE FUNCTION public.report_overdue_installments(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_overdue_installments(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_overdue_installments TO authenticated;

-- 16. Collection Effectiveness
CREATE OR REPLACE FUNCTION public.report_collection_effectiveness(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_collection_effectiveness(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_collection_effectiveness TO authenticated;

-- 17. Profit Margin
CREATE OR REPLACE FUNCTION public.report_profit_margin(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_profit_margin(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_profit_margin TO authenticated;

-- 18. Cash Flow
CREATE OR REPLACE FUNCTION public.report_cash_flow(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_cash_flow(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_cash_flow TO authenticated;
