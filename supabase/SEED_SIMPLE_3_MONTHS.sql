-- ============================================================================
-- SCRIPT SIMPLIFICADO: CARGAR DATOS DE 3 MESES
-- Diciembre 2025 - Febrero 2026
-- ============================================================================

-- PASO 1: Catálogos y Clientes
DO $$
DECLARE
  admin_user_id UUID;
  brand_id UUID;
  category_id UUID;
  size_id UUID;
  line_id UUID;
  i INTEGER;
BEGIN
  -- Verificar usuario admin
  SELECT id INTO admin_user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un usuario admin';
  END IF;
  
  RAISE NOTICE 'Usuario admin: %', admin_user_id;
  
  -- Catálogos
  INSERT INTO brands (name, active) VALUES
  ('Nike', true), ('Adidas', true), ('Puma', true), ('Reebok', true)
  ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO categories (name, active) VALUES
  ('Calzado', true), ('Ropa', true), ('Accesorios', true)
  ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO sizes (name, active) VALUES
  ('S', true), ('M', true), ('L', true), ('XL', true)
  ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO lines (name, active) VALUES
  ('Hombres', true), ('Mujeres', true), ('Unisex', true)
  ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO suppliers (name, contact_name, phone, email, active) VALUES
  ('Proveedor A', 'Juan Pérez', '555-1001', 'proveedora@email.com', true)
  ON CONFLICT (name) DO NOTHING;
  
  -- Clientes
  INSERT INTO clients (name, phone, address, credit_limit, credit_used, active) VALUES
  ('Juan Pérez', '555-1001', 'Av. Principal 123', 3000, 0, true),
  ('María García', '555-1002', 'Jr. Comercio 456', 5000, 0, true),
  ('Carlos López', '555-1003', 'Calle Lima 789', 2000, 0, true),
  ('Ana Martínez', '555-1004', 'Av. Grau 321', 4000, 0, true),
  ('Luis Rodríguez', '555-1005', 'Jr. Unión 654', 3500, 0, true)
  ON CONFLICT (phone) DO NOTHING;
  
  FOR i IN 6..50 LOOP
    INSERT INTO clients (name, phone, address, credit_limit, credit_used, active)
    VALUES (
      'Cliente ' || i,
      '555-' || LPAD(i::TEXT, 4, '0'),
      'Dirección ' || i,
      3000,
      0,
      true
    )
    ON CONFLICT (phone) DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Clientes creados: 50';
  
  -- Productos
  SELECT id INTO brand_id FROM brands LIMIT 1;
  SELECT id INTO category_id FROM categories LIMIT 1;
  SELECT id INTO size_id FROM sizes LIMIT 1;
  SELECT id INTO line_id FROM lines LIMIT 1;
  
  FOR i IN 1..100 LOOP
    INSERT INTO products (
      code, name, brand_id, category_id, size_id, line_id,
      cost_price, sale_price, stock, min_stock, active
    ) VALUES (
      'PROD-' || LPAD(i::TEXT, 5, '0'),
      'Producto ' || i,
      brand_id, category_id, size_id, line_id,
      50.00 + (i * 2),
      100.00 + (i * 5),
      50,
      10,
      true
    )
    ON CONFLICT (code) DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Productos creados: 100';
  RAISE NOTICE '✅ Catálogos base completados';
  
END $$;

-- PASO 2: Generar Ventas y Turnos de Caja
DO $$
DECLARE
  v_admin_user_id UUID;
  v_start_date DATE := '2025-12-01';
  v_end_date DATE := '2026-02-28';
  v_current_date DATE;
  v_shift_id UUID;
  v_sale_id UUID;
  v_client_ids UUID[];
  v_product_ids UUID[];
  v_i INTEGER;
BEGIN
  -- Obtener IDs necesarios
  SELECT id INTO v_admin_user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  SELECT ARRAY_AGG(id) INTO v_client_ids FROM clients WHERE active = true;
  SELECT ARRAY_AGG(id) INTO v_product_ids FROM products WHERE active = true;
  
  RAISE NOTICE 'Generando datos desde % hasta %', v_start_date, v_end_date;
  
  v_current_date := v_start_date;
  
  WHILE v_current_date <= v_end_date LOOP
    
    -- ========== TIENDA HOMBRES ==========
    INSERT INTO cash_shifts (
      store_id, user_id, opening_amount, opened_at, 
      closing_amount, expected_amount, difference, closed_at, status
    )
    VALUES (
      'TIENDA_HOMBRES', 
      v_admin_user_id, 
      500, 
      v_current_date + INTERVAL '8 hours',
      1500, 
      1500, 
      0, 
      v_current_date + INTERVAL '20 hours', 
      'CLOSED'
    )
    RETURNING id INTO v_shift_id;
    
    -- 10 ventas para tienda hombres
    FOR v_i IN 1..10 LOOP
      INSERT INTO sales (
        sale_number, client_id, user_id, store_id, 
        total_amount, payment_type, status, created_at
      )
      VALUES (
        'V-' || TO_CHAR(v_current_date, 'YYYYMMDD') || '-H-' || LPAD(v_i::TEXT, 4, '0'),
        v_client_ids[FLOOR(RANDOM() * ARRAY_LENGTH(v_client_ids, 1) + 1)],
        v_admin_user_id,
        'TIENDA_HOMBRES',
        FLOOR(RANDOM() * 200 + 100),
        CASE WHEN RANDOM() < 0.7 THEN 'CASH' ELSE 'CREDIT' END,
        'COMPLETED',
        v_current_date + INTERVAL '10 hours' + (v_i || ' minutes')::INTERVAL
      ) 
      RETURNING id INTO v_sale_id;
      
      -- Item de venta
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
      VALUES (
        v_sale_id, 
        v_product_ids[FLOOR(RANDOM() * ARRAY_LENGTH(v_product_ids, 1) + 1)], 
        1, 
        100, 
        100
      );
      
      UPDATE sales SET total_amount = 100 WHERE id = v_sale_id;
    END LOOP;
    
    -- ========== TIENDA MUJERES ==========
    INSERT INTO cash_shifts (
      store_id, user_id, opening_amount, opened_at, 
      closing_amount, expected_amount, difference, closed_at, status
    )
    VALUES (
      'TIENDA_MUJERES', 
      v_admin_user_id, 
      500, 
      v_current_date + INTERVAL '8 hours',
      1500, 
      1500, 
      0, 
      v_current_date + INTERVAL '20 hours', 
      'CLOSED'
    )
    RETURNING id INTO v_shift_id;
    
    -- 10 ventas para tienda mujeres
    FOR v_i IN 1..10 LOOP
      INSERT INTO sales (
        sale_number, client_id, user_id, store_id, 
        total_amount, payment_type, status, created_at
      )
      VALUES (
        'V-' || TO_CHAR(v_current_date, 'YYYYMMDD') || '-M-' || LPAD(v_i::TEXT, 4, '0'),
        v_client_ids[FLOOR(RANDOM() * ARRAY_LENGTH(v_client_ids, 1) + 1)],
        v_admin_user_id,
        'TIENDA_MUJERES',
        FLOOR(RANDOM() * 200 + 100),
        CASE WHEN RANDOM() < 0.7 THEN 'CASH' ELSE 'CREDIT' END,
        'COMPLETED',
        v_current_date + INTERVAL '10 hours' + (v_i || ' minutes')::INTERVAL
      ) 
      RETURNING id INTO v_sale_id;
      
      -- Item de venta
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
      VALUES (
        v_sale_id, 
        v_product_ids[FLOOR(RANDOM() * ARRAY_LENGTH(v_product_ids, 1) + 1)], 
        1, 
        100, 
        100
      );
      
      UPDATE sales SET total_amount = 100 WHERE id = v_sale_id;
    END LOOP;
    
    -- Avanzar al siguiente día
    v_current_date := v_current_date + INTERVAL '1 day';
    
    -- Mostrar progreso cada 10 días
    IF EXTRACT(DAY FROM v_current_date)::INTEGER % 10 = 0 THEN
      RAISE NOTICE 'Procesado: %', v_current_date;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Datos de ventas y turnos generados exitosamente';
END $$;

-- ============================================================================
-- RESUMEN DE DATOS CARGADOS
-- ============================================================================

SELECT 
  'Clientes' as tabla, COUNT(*) as registros FROM clients
UNION ALL
SELECT 'Productos', COUNT(*) FROM products
UNION ALL
SELECT 'Ventas', COUNT(*) FROM sales
UNION ALL
SELECT 'Turnos de Caja', COUNT(*) FROM cash_shifts;

SELECT 
  TO_CHAR(created_at, 'YYYY-MM') as mes,
  store_id,
  COUNT(*) as ventas,
  SUM(total_amount) as total
FROM sales
GROUP BY TO_CHAR(created_at, 'YYYY-MM'), store_id
ORDER BY mes, store_id;
