-- ============================================================================
-- QUERIES DE VERIFICACIÓN DESPUÉS DE EJECUTAR ADD_STOCK_ONLY.sql
-- ============================================================================

-- 1. Verificar que hay stock para todos los productos activos
SELECT 
  'Productos activos' as descripcion,
  COUNT(*) as cantidad
FROM products 
WHERE active = true

UNION ALL

SELECT 
  'Productos con stock',
  COUNT(DISTINCT product_id)
FROM stock;

-- 2. Verificar stock por tienda
SELECT 
  warehouse_id as tienda,
  COUNT(*) as productos_con_stock,
  SUM(quantity) as stock_total,
  ROUND(AVG(quantity), 2) as promedio_por_producto,
  MIN(quantity) as stock_minimo,
  MAX(quantity) as stock_maximo
FROM stock
GROUP BY warehouse_id;

-- 3. Verificar movimientos por tipo
SELECT 
  type as tipo_movimiento,
  COUNT(*) as cantidad_movimientos,
  SUM(quantity) as unidades_totales,
  ROUND(AVG(quantity), 2) as promedio_por_movimiento
FROM movements
GROUP BY type
ORDER BY type;

-- 4. Verificar que los movimientos de salida coinciden con las ventas
SELECT 
  'Ventas no anuladas' as descripcion,
  COUNT(*) as cantidad
FROM sales 
WHERE voided = false

UNION ALL

SELECT 
  'Items vendidos',
  COUNT(*)
FROM sale_items si
INNER JOIN sales s ON si.sale_id = s.id
WHERE s.voided = false

UNION ALL

SELECT 
  'Movimientos de salida',
  COUNT(*)
FROM movements
WHERE type = 'SALIDA';

-- 5. Verificar balance de inventario (Entradas - Salidas = Stock actual)
WITH inventory_balance AS (
  SELECT 
    warehouse_id,
    product_id,
    SUM(CASE WHEN type = 'ENTRADA' THEN quantity ELSE 0 END) as total_entradas,
    SUM(CASE WHEN type = 'SALIDA' THEN quantity ELSE 0 END) as total_salidas
  FROM movements
  GROUP BY warehouse_id, product_id
)
SELECT 
  ib.warehouse_id,
  ib.product_id,
  p.name as producto,
  ib.total_entradas,
  ib.total_salidas,
  (ib.total_entradas - ib.total_salidas) as balance_calculado,
  s.quantity as stock_actual,
  CASE 
    WHEN (ib.total_entradas - ib.total_salidas) = s.quantity THEN '✅ OK'
    ELSE '❌ ERROR'
  END as estado
FROM inventory_balance ib
INNER JOIN stock s ON ib.warehouse_id = s.warehouse_id AND ib.product_id = s.product_id
INNER JOIN products p ON ib.product_id = p.id
ORDER BY estado DESC, ib.warehouse_id, p.name
LIMIT 20;

-- 6. Ver productos con más ventas
SELECT 
  p.barcode,
  p.name as producto,
  COUNT(DISTINCT s.id) as numero_ventas,
  SUM(si.quantity) as unidades_vendidas,
  ROUND(SUM(si.subtotal), 2) as total_ingresos
FROM sale_items si
INNER JOIN sales s ON si.sale_id = s.id
INNER JOIN products p ON si.product_id = p.id
WHERE s.voided = false
GROUP BY p.id, p.barcode, p.name
ORDER BY unidades_vendidas DESC
LIMIT 10;

-- 7. Ver stock actual de los productos más vendidos
SELECT 
  p.barcode,
  p.name as producto,
  SUM(CASE WHEN s.warehouse_id = 'TIENDA_HOMBRES' THEN s.quantity ELSE 0 END) as stock_hombres,
  SUM(CASE WHEN s.warehouse_id = 'TIENDA_MUJERES' THEN s.quantity ELSE 0 END) as stock_mujeres,
  SUM(s.quantity) as stock_total
FROM stock s
INNER JOIN products p ON s.product_id = p.id
GROUP BY p.id, p.barcode, p.name
ORDER BY stock_total DESC
LIMIT 10;

-- 8. Verificar fechas de movimientos
SELECT 
  type as tipo,
  MIN(created_at) as fecha_mas_antigua,
  MAX(created_at) as fecha_mas_reciente,
  COUNT(*) as cantidad
FROM movements
GROUP BY type;

-- 9. Verificar que no hay stock negativo
SELECT 
  COUNT(*) as productos_con_stock_negativo
FROM stock
WHERE quantity < 0;

-- 10. Resumen general
SELECT 
  'Total productos' as metrica,
  COUNT(*)::TEXT as valor
FROM products WHERE active = true

UNION ALL

SELECT 
  'Total stock registros',
  COUNT(*)::TEXT
FROM stock

UNION ALL

SELECT 
  'Total movimientos',
  COUNT(*)::TEXT
FROM movements

UNION ALL

SELECT 
  'Stock total unidades',
  SUM(quantity)::TEXT
FROM stock

UNION ALL

SELECT 
  'Entradas totales',
  SUM(quantity)::TEXT
FROM movements WHERE type = 'ENTRADA'

UNION ALL

SELECT 
  'Salidas totales',
  SUM(quantity)::TEXT
FROM movements WHERE type = 'SALIDA';
