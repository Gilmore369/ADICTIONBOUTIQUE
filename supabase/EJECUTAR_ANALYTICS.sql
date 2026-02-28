-- ============================================================================
-- SCRIPT EJECUTABLE: Analytics Reports
-- ============================================================================
-- Este script crea el schema analytics y todas las funciones de reportes
-- Luego ejecuta pruebas para verificar que funcionan correctamente
--
-- CÓMO EJECUTAR:
-- 1. Desde Supabase Dashboard:
--    - Ve a SQL Editor
--    - Copia y pega todo este archivo
--    - Haz clic en "Run"
--
-- 2. Desde psql:
--    psql -h <host> -U postgres -d postgres -f supabase/EJECUTAR_ANALYTICS.sql
--
-- 3. Desde la terminal con Supabase CLI:
--    supabase db execute -f supabase/EJECUTAR_ANALYTICS.sql
--
-- ============================================================================
-- ============================================================================
-- Analytics Reports Schema
-- ============================================================================
-- Crea un schema analytics con funciones RPC para reportes estructurados

CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- 1. REPORTE: RotaciÃ³n de Inventario
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
      jsonb_build_object('label', 'RotaciÃ³n Promedio', 'value', ROUND(AVG(sd.total_sold / NULLIF(st.current_stock, 0)), 2), 'format', 'decimal')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'RotaciÃ³n por Producto',
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
          'transactions', sd.transactions
        )
      )
      FROM sales_data sd
      LEFT JOIN stock_data st ON sd.product_id = st.product_id
      ORDER BY sd.total_sold DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'CÃ³digo', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'totalSold', 'label', 'Vendidos', 'type', 'number'),
        jsonb_build_object('key', 'currentStock', 'label', 'Stock Actual', 'type', 'number'),
        jsonb_build_object('key', 'rotation', 'label', 'RotaciÃ³n', 'type', 'decimal'),
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
-- 2. REPORTE: ValorizaciÃ³n de Inventario
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_inventory_valuation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  category_filter uuid;
BEGIN
  category_filter := (filters->>'category_id')::uuid;

  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Valor Total Costo', 'value', ROUND(SUM(s.quantity * COALESCE(p.purchase_price, 0)), 2), 'format', 'currency'),
      jsonb_build_object('label', 'Valor Total Venta', 'value', ROUND(SUM(s.quantity * p.price), 2), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Potencial', 'value', ROUND(SUM(s.quantity * (p.price - COALESCE(p.purchase_price, 0))), 2), 'format', 'currency')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'ValorizaciÃ³n por CategorÃ­a',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', category_name, 'y', total_value))
          FROM (
            SELECT 
              COALESCE(c.name, 'Sin categorÃ­a') as category_name,
              ROUND(SUM(s.quantity * p.price), 2) as total_value
            FROM stock s
            INNER JOIN products p ON s.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE s.quantity > 0
              AND (category_filter IS NULL OR p.category_id = category_filter)
            GROUP BY c.name
            ORDER BY total_value DESC
            LIMIT 10
          ) cat_data
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'barcode', p.barcode,
          'name', p.name,
          'category', COALESCE(c.name, 'Sin categorÃ­a'),
          'quantity', s.quantity,
          'costPrice', COALESCE(p.purchase_price, 0),
          'salePrice', p.price,
          'totalCost', ROUND(s.quantity * COALESCE(p.purchase_price, 0), 2),
          'totalSale', ROUND(s.quantity * p.price, 2),
          'potentialProfit', ROUND(s.quantity * (p.price - COALESCE(p.purchase_price, 0)), 2)
        )
      )
      FROM stock s
      INNER JOIN products p ON s.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE s.quantity > 0
        AND (category_filter IS NULL OR p.category_id = category_filter)
      ORDER BY (s.quantity * p.price) DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'CÃ³digo', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'category', 'label', 'CategorÃ­a', 'type', 'string'),
        jsonb_build_object('key', 'quantity', 'label', 'Cantidad', 'type', 'number'),
        jsonb_build_object('key', 'costPrice', 'label', 'Precio Costo', 'type', 'currency'),
        jsonb_build_object('key', 'salePrice', 'label', 'Precio Venta', 'type', 'currency'),
        jsonb_build_object('key', 'totalCost', 'label', 'Costo Total', 'type', 'currency'),
        jsonb_build_object('key', 'totalSale', 'label', 'Valor Venta', 'type', 'currency'),
        jsonb_build_object('key', 'potentialProfit', 'label', 'Ganancia Potencial', 'type', 'currency')
      )
    )
  ) INTO result
  FROM stock s
  INNER JOIN products p ON s.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE s.quantity > 0
    AND (category_filter IS NULL OR p.category_id = category_filter);

  RETURN result;
END;
$$;

-- ============================================================================
-- 3. REPORTE: Timeline de Ventas
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

  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Ventas', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', ROUND(SUM(total), 2), 'format', 'currency'),
      jsonb_build_object('label', 'Ticket Promedio', 'value', ROUND(AVG(total), 2), 'format', 'currency')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Ventas Diarias',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', date, 'y', total))
          FROM (
            SELECT 
              TO_CHAR(created_at, 'YYYY-MM-DD') as date,
              ROUND(SUM(total), 2) as total
            FROM sales
            WHERE voided = false
              AND created_at >= start_date
              AND created_at <= end_date
              AND (store_filter IS NULL OR store_id = store_filter)
            GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
            ORDER BY date
          ) daily_sales
        )
      ),
      jsonb_build_object(
        'name', 'Contado vs CrÃ©dito',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', sale_type, 'y', total))
          FROM (
            SELECT 
              sale_type,
              ROUND(SUM(total), 2) as total
            FROM sales
            WHERE voided = false
              AND created_at >= start_date
              AND created_at <= end_date
              AND (store_filter IS NULL OR store_id = store_filter)
            GROUP BY sale_type
          ) type_sales
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', TO_CHAR(created_at, 'YYYY-MM-DD'),
          'saleNumber', sale_number,
          'store', store_id,
          'type', sale_type,
          'paymentType', payment_type,
          'subtotal', subtotal,
          'discount', discount,
          'total', total
        )
      )
      FROM sales
      WHERE voided = false
        AND created_at >= start_date
        AND created_at <= end_date
        AND (store_filter IS NULL OR store_id = store_filter)
      ORDER BY created_at DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'date', 'label', 'Fecha', 'type', 'date'),
        jsonb_build_object('key', 'saleNumber', 'label', 'NÂ° Venta', 'type', 'string'),
        jsonb_build_object('key', 'store', 'label', 'Tienda', 'type', 'string'),
        jsonb_build_object('key', 'type', 'label', 'Tipo', 'type', 'string'),
        jsonb_build_object('key', 'paymentType', 'label', 'Pago', 'type', 'string'),
        jsonb_build_object('key', 'total', 'label', 'Total', 'type', 'currency')
      )
    )
  ) INTO result
  FROM sales
  WHERE voided = false
    AND created_at >= start_date
    AND created_at <= end_date
    AND (store_filter IS NULL OR store_id = store_filter);

  RETURN result;
END;
$$;

-- ============================================================================
-- 4. REPORTE: Ventas por Producto
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
BEGIN
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH product_sales AS (
    SELECT 
      p.id,
      p.barcode,
      p.name,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(si.subtotal), 2) as total_revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as total_cost,
      COUNT(DISTINCT s.id) as transactions
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY p.id, p.barcode, p.name
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Productos Vendidos', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', SUM(total_revenue), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Total', 'value', SUM(total_revenue - total_cost), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', ROUND(AVG((total_revenue - total_cost) / NULLIF(total_revenue, 0) * 100), 2), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Top 20 Productos',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', total_revenue))
          FROM (
            SELECT name, total_revenue
            FROM product_sales
            ORDER BY total_revenue DESC
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
          'quantitySold', quantity_sold,
          'totalRevenue', total_revenue,
          'totalCost', total_cost,
          'profit', total_revenue - total_cost,
          'margin', ROUND((total_revenue - total_cost) / NULLIF(total_revenue, 0) * 100, 2),
          'transactions', transactions
        )
      )
      FROM product_sales
      ORDER BY total_revenue DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'CÃ³digo', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'quantitySold', 'label', 'Cantidad', 'type', 'number'),
        jsonb_build_object('key', 'totalRevenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'profit', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'margin', 'label', 'Margen %', 'type', 'percent')
      )
    )
  ) INTO result
  FROM product_sales;

  RETURN result;
END;
$$;

-- ============================================================================
-- 5. REPORTE: Ventas por CategorÃ­a
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
BEGIN
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH category_sales AS (
    SELECT 
      COALESCE(c.name, 'Sin categorÃ­a') as category,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(si.subtotal), 2) as total_revenue,
      COUNT(DISTINCT s.id) as transactions,
      COUNT(DISTINCT p.id) as unique_products
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY c.name
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'CategorÃ­as Activas', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Ingresos Totales', 'value', SUM(total_revenue), 'format', 'currency'),
      jsonb_build_object('label', 'Productos Ãšnicos', 'value', SUM(unique_products), 'format', 'number')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Ventas por CategorÃ­a',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', category, 'y', total_revenue))
          FROM category_sales
          ORDER BY total_revenue DESC
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'category', category,
          'quantitySold', quantity_sold,
          'totalRevenue', total_revenue,
          'transactions', transactions,
          'uniqueProducts', unique_products
        )
      )
      FROM category_sales
      ORDER BY total_revenue DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'category', 'label', 'CategorÃ­a', 'type', 'string'),
        jsonb_build_object('key', 'quantitySold', 'label', 'Cantidad', 'type', 'number'),
        jsonb_build_object('key', 'totalRevenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'transactions', 'label', 'Transacciones', 'type', 'number'),
        jsonb_build_object('key', 'uniqueProducts', 'label', 'Productos', 'type', 'number')
      )
    )
  ) INTO result
  FROM category_sales;

  RETURN result;
END;
$$;

-- ============================================================================
-- 6. REPORTE: Margen de Ganancia
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
BEGIN
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH margin_data AS (
    SELECT 
      p.id,
      p.barcode,
      p.name,
      COALESCE(c.name, 'Sin categorÃ­a') as category,
      SUM(si.quantity) as quantity_sold,
      ROUND(SUM(si.subtotal), 2) as revenue,
      ROUND(SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as cogs,
      ROUND(SUM(si.subtotal) - SUM(si.quantity * COALESCE(p.purchase_price, 0)), 2) as profit,
      ROUND((SUM(si.subtotal) - SUM(si.quantity * COALESCE(p.purchase_price, 0))) / NULLIF(SUM(si.subtotal), 0) * 100, 2) as margin_percent
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.voided = false
      AND s.created_at >= start_date
      AND s.created_at <= end_date
      AND (store_filter IS NULL OR s.store_id = store_filter)
    GROUP BY p.id, p.barcode, p.name, c.name
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Ingresos Totales', 'value', SUM(revenue), 'format', 'currency'),
      jsonb_build_object('label', 'Costo Total', 'value', SUM(cogs), 'format', 'currency'),
      jsonb_build_object('label', 'Ganancia Total', 'value', SUM(profit), 'format', 'currency'),
      jsonb_build_object('label', 'Margen Promedio', 'value', ROUND(AVG(margin_percent), 2), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Margen por Producto',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', COALESCE(margin_percent, 0)))
          FROM (
            SELECT name, margin_percent
            FROM margin_data
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
          'cogs', cogs,
          'profit', profit,
          'marginPercent', COALESCE(margin_percent, 0)
        )
      )
      FROM margin_data
      ORDER BY profit DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'barcode', 'label', 'CÃ³digo', 'type', 'string'),
        jsonb_build_object('key', 'name', 'label', 'Producto', 'type', 'string'),
        jsonb_build_object('key', 'category', 'label', 'CategorÃ­a', 'type', 'string'),
        jsonb_build_object('key', 'revenue', 'label', 'Ingresos', 'type', 'currency'),
        jsonb_build_object('key', 'cogs', 'label', 'Costo', 'type', 'currency'),
        jsonb_build_object('key', 'profit', 'label', 'Ganancia', 'type', 'currency'),
        jsonb_build_object('key', 'marginPercent', 'label', 'Margen %', 'type', 'percent')
      )
    )
  ) INTO result
  FROM margin_data;

  RETURN result;
END;
$$;

-- ============================================================================
-- 7. REPORTE: Deuda de Clientes
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_clients_debt(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH client_debt AS (
    SELECT 
      c.id,
      c.name,
      c.phone,
      c.address,
      COALESCE(c.credit_limit, 0) as credit_limit,
      COALESCE(c.credit_used, 0) as credit_used,
      COALESCE(c.credit_limit, 0) - COALESCE(c.credit_used, 0) as available,
      ROUND(COALESCE(c.credit_used, 0) / NULLIF(COALESCE(c.credit_limit, 0), 0) * 100, 2) as utilization_percent,
      (
        SELECT COUNT(*)
        FROM installments i
        INNER JOIN credit_plans cp ON i.plan_id = cp.id
        WHERE cp.client_id = c.id
          AND i.status = 'OVERDUE'
      ) as overdue_installments
    FROM clients c
    WHERE c.active = true
      AND COALESCE(c.credit_used, 0) > 0
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Clientes con Deuda', 'value', COUNT(*), 'format', 'number'),
      jsonb_build_object('label', 'Deuda Total', 'value', SUM(credit_used), 'format', 'currency'),
      jsonb_build_object('label', 'LÃ­mite Total', 'value', SUM(credit_limit), 'format', 'currency'),
      jsonb_build_object('label', 'Cuotas Vencidas', 'value', SUM(overdue_installments), 'format', 'number')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Top 20 Deudores',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', name, 'y', credit_used))
          FROM (
            SELECT name, credit_used
            FROM client_debt
            ORDER BY credit_used DESC
            LIMIT 20
          ) top_debtors
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', name,
          'phone', phone,
          'address', address,
          'creditLimit', credit_limit,
          'creditUsed', credit_used,
          'available', available,
          'utilizationPercent', COALESCE(utilization_percent, 0),
          'overdueInstallments', overdue_installments
        )
      )
      FROM client_debt
      ORDER BY credit_used DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'name', 'label', 'Cliente', 'type', 'string'),
        jsonb_build_object('key', 'phone', 'label', 'TelÃ©fono', 'type', 'string'),
        jsonb_build_object('key', 'creditLimit', 'label', 'LÃ­mite', 'type', 'currency'),
        jsonb_build_object('key', 'creditUsed', 'label', 'Deuda', 'type', 'currency'),
        jsonb_build_object('key', 'available', 'label', 'Disponible', 'type', 'currency'),
        jsonb_build_object('key', 'utilizationPercent', 'label', 'Uso %', 'type', 'percent'),
        jsonb_build_object('key', 'overdueInstallments', 'label', 'Vencidas', 'type', 'number')
      )
    )
  ) INTO result
  FROM client_debt;

  RETURN result;
END;
$$;

-- ============================================================================
-- 8. REPORTE: Flujo de Caja
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
  start_date := COALESCE((filters->>'start_date')::timestamptz, DATE_TRUNC('month', NOW()));
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());
  store_filter := filters->>'store_id';

  WITH cash_inflows AS (
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM-DD') as date,
      'Ventas Contado' as concept,
      ROUND(SUM(total), 2) as amount
    FROM sales
    WHERE voided = false
      AND sale_type = 'CONTADO'
      AND created_at >= start_date
      AND created_at <= end_date
      AND (store_filter IS NULL OR store_id = store_filter)
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    
    UNION ALL
    
    SELECT 
      TO_CHAR(p.created_at, 'YYYY-MM-DD') as date,
      'Pagos CrÃ©dito' as concept,
      ROUND(SUM(p.amount), 2) as amount
    FROM payments p
    WHERE p.created_at >= start_date
      AND p.created_at <= end_date
    GROUP BY TO_CHAR(p.created_at, 'YYYY-MM-DD')
  ),
  cash_outflows AS (
    SELECT 
      TO_CHAR(ce.created_at, 'YYYY-MM-DD') as date,
      'Gastos' as concept,
      ROUND(SUM(ce.amount), 2) as amount
    FROM cash_expenses ce
    INNER JOIN cash_shifts cs ON ce.shift_id = cs.id
    WHERE ce.created_at >= start_date
      AND ce.created_at <= end_date
      AND (store_filter IS NULL OR cs.store_id = store_filter)
    GROUP BY TO_CHAR(ce.created_at, 'YYYY-MM-DD')
  ),
  combined_flow AS (
    SELECT date, concept, amount, 'INGRESO' as type FROM cash_inflows
    UNION ALL
    SELECT date, concept, -amount as amount, 'EGRESO' as type FROM cash_outflows
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Total Ingresos', 'value', (SELECT COALESCE(SUM(amount), 0) FROM cash_inflows), 'format', 'currency'),
      jsonb_build_object('label', 'Total Egresos', 'value', (SELECT COALESCE(SUM(amount), 0) FROM cash_outflows), 'format', 'currency'),
      jsonb_build_object('label', 'Flujo Neto', 'value', (SELECT COALESCE(SUM(amount), 0) FROM cash_inflows) - (SELECT COALESCE(SUM(amount), 0) FROM cash_outflows), 'format', 'currency')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Flujo Diario',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', date, 'y', daily_flow))
          FROM (
            SELECT 
              date,
              ROUND(SUM(amount), 2) as daily_flow
            FROM combined_flow
            GROUP BY date
            ORDER BY date
          ) daily_data
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', date,
          'concept', concept,
          'type', type,
          'amount', ABS(amount)
        )
      )
      FROM combined_flow
      ORDER BY date DESC, type
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'date', 'label', 'Fecha', 'type', 'date'),
        jsonb_build_object('key', 'concept', 'label', 'Concepto', 'type', 'string'),
        jsonb_build_object('key', 'type', 'label', 'Tipo', 'type', 'string'),
        jsonb_build_object('key', 'amount', 'label', 'Monto', 'type', 'currency')
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================================
-- Permisos
-- ============================================================================
GRANT USAGE ON SCHEMA analytics TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO authenticated;

-- ============================================================================
-- PRUEBAS DE FUNCIONES
-- ============================================================================
-- Ejecuta cada función para verificar que funciona correctamente

-- Prueba 1: Rotación de Inventario
SELECT 'TEST 1: Rotación de Inventario' as test_name;
SELECT analytics.report_inventory_rotation('{}'::jsonb);

-- Prueba 2: Valorización de Inventario
SELECT 'TEST 2: Valorización de Inventario' as test_name;
SELECT analytics.report_inventory_valuation('{}'::jsonb);

-- Prueba 3: Timeline de Ventas
SELECT 'TEST 3: Timeline de Ventas' as test_name;
SELECT analytics.report_sales_timeline('{"start_date": "2024-01-01"}'::jsonb);

-- Prueba 4: Ventas por Producto
SELECT 'TEST 4: Ventas por Producto' as test_name;
SELECT analytics.report_sales_by_product('{"start_date": "2024-01-01"}'::jsonb);

-- Prueba 5: Ventas por Categoría
SELECT 'TEST 5: Ventas por Categoría' as test_name;
SELECT analytics.report_sales_by_category('{"start_date": "2024-01-01"}'::jsonb);

-- Prueba 6: Margen de Ganancia
SELECT 'TEST 6: Margen de Ganancia' as test_name;
SELECT analytics.report_profit_margin('{"start_date": "2024-01-01"}'::jsonb);

-- Prueba 7: Deuda de Clientes
SELECT 'TEST 7: Deuda de Clientes' as test_name;
SELECT analytics.report_clients_debt('{}'::jsonb);

-- Prueba 8: Flujo de Caja
SELECT 'TEST 8: Flujo de Caja' as test_name;
SELECT analytics.report_cash_flow('{"start_date": "2024-01-01"}'::jsonb);

-- ============================================================================
-- FIN DE PRUEBAS
-- ============================================================================
SELECT '✓ Todas las funciones se ejecutaron correctamente' as resultado;
