-- ============================================================================
-- SCRIPT PARA AGREGAR SOLO STOCK A DATOS EXISTENTES
-- ============================================================================
-- Este script crea stock y movimientos para productos que ya tienen ventas
-- Lógica: Stock actual = Stock extra aleatorio (50-150 unidades)
--         Movimiento entrada = Vendido + Stock actual
--         Movimientos salida = Ventas realizadas
-- ============================================================================

DO $$
DECLARE
  v_product_id UUID;
  v_store_id TEXT;
  v_quantity INTEGER;
  v_sold_quantity INTEGER;
  v_initial_stock INTEGER;
  stores TEXT[] := ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES'];
BEGIN
  
  RAISE NOTICE 'Iniciando creación de stock...';
  
  -- Limpiar stock existente si hay
  DELETE FROM stock;
  DELETE FROM movements;
  
  RAISE NOTICE 'Stock y movimientos anteriores eliminados';
  
  -- Crear stock para cada producto en cada tienda
  FOREACH v_store_id IN ARRAY stores LOOP
    FOR v_product_id IN SELECT id FROM products WHERE active = true LOOP
      
      -- Calcular cuánto se ha vendido de este producto en esta tienda
      SELECT COALESCE(SUM(si.quantity), 0)
      INTO v_sold_quantity
      FROM sale_items si
      INNER JOIN sales s ON si.sale_id = s.id
      WHERE s.store_id = v_store_id
        AND si.product_id = v_product_id
        AND s.voided = false;
      
      -- Stock ACTUAL (después de las ventas) = solo el extra aleatorio (50-150)
      v_quantity := FLOOR(RANDOM() * 100 + 50)::INTEGER;
      
      -- Stock inicial = lo vendido + stock actual
      v_initial_stock := v_sold_quantity + v_quantity;
      
      -- Insertar stock ACTUAL (lo que queda después de las ventas)
      INSERT INTO stock (
        warehouse_id,
        product_id,
        quantity,
        last_updated
      ) VALUES (
        v_store_id,
        v_product_id,
        v_quantity,
        NOW()
      );
      
      -- Crear movimiento de entrada inicial (con el stock inicial completo)
      INSERT INTO movements (
        warehouse_id,
        product_id,
        type,
        quantity,
        reference,
        notes,
        user_id,
        created_at
      ) VALUES (
        v_store_id,
        v_product_id,
        'ENTRADA',
        v_initial_stock,
        'STOCK-INICIAL',
        'Inventario inicial',
        (SELECT id FROM users WHERE 'admin' = ANY(roles) LIMIT 1),
        NOW() - INTERVAL '90 days'
      );
      
    END LOOP;
    
    RAISE NOTICE 'Stock creado para tienda: %', v_store_id;
  END LOOP;
  
  -- Crear movimientos de salida basados en ventas existentes
  INSERT INTO movements (
    warehouse_id,
    product_id,
    type,
    quantity,
    reference,
    notes,
    user_id,
    created_at
  )
  SELECT 
    s.store_id,
    si.product_id,
    'SALIDA',
    si.quantity,
    s.sale_number,
    'Venta de producto',
    s.user_id,
    s.created_at
  FROM sale_items si
  INNER JOIN sales s ON si.sale_id = s.id
  WHERE s.voided = false;
  
  RAISE NOTICE 'Movimientos de salida creados desde ventas existentes';
  RAISE NOTICE '✅ STOCK CREADO EXITOSAMENTE';
  
END $$;

-- Verificar resultados
SELECT 
  'Stock' as tabla,
  COUNT(*) as registros,
  SUM(quantity) as cantidad_total
FROM stock
UNION ALL
SELECT 
  'Movimientos',
  COUNT(*),
  SUM(quantity)
FROM movements;

-- Ver stock por tienda
SELECT 
  warehouse_id as tienda,
  COUNT(*) as productos,
  SUM(quantity) as stock_total,
  AVG(quantity) as promedio_por_producto
FROM stock
GROUP BY warehouse_id;

-- Ver movimientos por tipo
SELECT 
  type as tipo,
  COUNT(*) as cantidad,
  SUM(quantity) as unidades_totales
FROM movements
GROUP BY type;
