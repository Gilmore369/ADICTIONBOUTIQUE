-- ============================================================================
-- SCRIPT COMPLETO: CARGAR DATOS DE 3 MESES (VERSIÓN SIMPLIFICADA)
-- Diciembre 2025 - Febrero 2026
-- ============================================================================
-- INSTRUCCIONES:
-- 1. Copia TODO este archivo
-- 2. Pégalo en el SQL Editor de Supabase
-- 3. Ejecuta (puede tardar 1-2 minutos)
-- ============================================================================

DO $$
DECLARE
  admin_user_id UUID;
  brand_id UUID;
  category_id UUID;
  size_id UUID;
  line_id UUID;
  supplier_id UUID;
  
  start_date DATE := '2025-12-01';
  end_date DATE := '2026-02-28';
  current_date DATE;
  stores TEXT[] := ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES'];
  store_id TEXT;
  shift_id UUID;
  sale_id UUID;
  plan_id UUID;
  client_ids UUID[];
  product_ids UUID[];
  
  opening_amount DECIMAL;
  daily_cash_sales DECIMAL;
  daily_expenses DECIMAL;
  closing_amount DECIMAL;
  
  sales_per_day INTEGER;
  payment_type TEXT;
  sale_total DECIMAL;
  num_items INTEGER;
  installment_count INTEGER;
  installment_amount DECIMAL;
  
  product_id UUID;
  quantity INTEGER;
  unit_price DECIMAL;
  subtotal DECIMAL;
  expense_amount DECIMAL;
  due_date DATE;
  inst_status TEXT;
  
BEGIN
  -- Verificar que existe un usuario admin
  SELECT id INTO admin_user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un usuario admin. Por favor crea un usuario admin primero.';
  END IF;
  
  RAISE NOTICE 'Usando usuario admin: %', admin_user_id;
  
  -- ============================================================================
  -- 1. CREAR CATÁLOGOS BASE
  -- ============================================================================
  
  -- Marcas
  INSERT INTO brands (name, active) VALUES
  ('Nike', true), ('Adidas', true), ('Puma', true), ('Reebok', true), 
  ('New Balance', true), ('Converse', true), ('Vans', true), ('Fila', true)
  ON CONFLICT (name) DO NOTHING;
  
  -- Categorías
  INSERT INTO categories (name, active) VALUES
  ('Calzado', true), ('Ropa', true), ('Accesorios', true), ('Deportivo', true)
  ON CONFLICT (name) DO NOTHING;
  
  -- Tallas
  INSERT INTO sizes (name, active) VALUES
  ('XS', true), ('S', true), ('M', true), ('L', true), ('XL', true), ('XXL', true),
  ('36', true), ('38', true), ('40', true), ('42', true), ('44', true)
  ON CONFLICT (name) DO NOTHING;
  
  -- Líneas
  INSERT INTO lines (name, active) VALUES
  ('Hombres', true), ('Mujeres', true), ('Unisex', true), ('Premium', true)
  ON CONFLICT (name) DO NOTHING;
  
  -- Proveedores
  INSERT INTO suppliers (name, contact_name, phone, email, active) VALUES
  ('Proveedor A', 'Juan Pérez', '555-1001', 'proveedora@email.com', true),
  ('Proveedor B', 'María García', '555-1002', 'proveedorb@email.com', true),
  ('Proveedor C', 'Carlos López', '555-1003', 'proveedorc@email.com', true)
  ON CONFLICT (name) DO NOTHING;
  
  RAISE NOTICE 'Catálogos creados';
  
  -- ============================================================================
  -- 2. CREAR CLIENTES (50 clientes)
  -- ============================================================================
  
  INSERT INTO clients (name, phone, address, credit_limit, credit_used, active, birthday) VALUES
  ('Juan Pérez', '555-1001', 'Av. Principal 123', 3000, 0, true, '1985-03-15'),
  ('María García', '555-1002', 'Jr. Comercio 456', 5000, 0, true, '1990-07-22'),
  ('Carlos López', '555-1003', 'Calle Lima 789', 2000, 0, true, '1988-12-10'),
  ('Ana Martínez', '555-1004', 'Av. Grau 321', 4000, 0, true, '1992-05-18'),
  ('Luis Rodríguez', '555-1005', 'Jr. Unión 654', 3500, 0, true, '1987-09-25'),
  ('Carmen Fernández', '555-1006', 'Calle Real 987', 2500, 0, true, '1995-01-30'),
  ('José González', '555-1007', 'Av. Bolívar 147', 3000, 0, true, '1989-11-12'),
  ('Laura Sánchez', '555-1008', 'Jr. Ayacucho 258', 4500, 0, true, '1991-04-08'),
  ('Miguel Ramírez', '555-1009', 'Calle Sucre 369', 2000, 0, true, '1993-08-14'),
  ('Isabel Torres', '555-1010', 'Av. Arequipa 741', 5000, 0, true, '1986-02-20')
  ON CONFLICT (phone) DO NOTHING;
  
  -- Agregar 40 clientes más
  FOR i IN 11..50 LOOP
    INSERT INTO clients (name, phone, address, credit_limit, credit_used, active)
    VALUES (
      'Cliente ' || i,
      '555-' || LPAD(i::TEXT, 4, '0'),
      'Dirección ' || i,
      (ARRAY[2000, 3000, 4000, 5000])[FLOOR(RANDOM() * 4 + 1)],
      0,
      true
    )
    ON CONFLICT (phone) DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Clientes creados: 50';
  
  -- ============================================================================
  -- 3. CREAR PRODUCTOS (100 productos)
  -- ============================================================================
  
  SELECT id INTO brand_id FROM brands LIMIT 1;
  SELECT id INTO category_id FROM categories LIMIT 1;
  SELECT id INTO size_id FROM sizes LIMIT 1;
  SELECT id INTO line_id FROM lines LIMIT 1;
  SELECT id INTO supplier_id FROM suppliers LIMIT 1;
  
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
      FLOOR(RANDOM() * 100 + 20),
      10,
      true
    )
    ON CONFLICT (code) DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Productos creados: 100';
  
  -- ============================================================================
  -- 4. GENERAR VENTAS Y TURNOS DE CAJA (3 MESES)
  -- ============================================================================
  
  -- Obtener IDs de clientes y productos
  SELECT ARRAY_AGG(id) INTO client_ids FROM clients WHERE active = true;
  SELECT ARRAY_AGG(id) INTO product_ids FROM products WHERE active = true;
  
  RAISE NOTICE 'Generando datos desde % hasta %', start_date, end_date;
  
  -- Loop por cada día
  current_date := start_date;
  WHILE current_date <= end_date LOOP
    
    -- Loop por cada tienda
    FOREACH store_id IN ARRAY stores LOOP
      opening_amount := 500.00;
      daily_cash_sales := 0;
      daily_expenses := 0;
      
      -- Crear turno de caja
      INSERT INTO cash_shifts (
        store_id, user_id, opening_amount, opened_at, status
      ) VALUES (
        store_id,
        admin_user_id,
        opening_amount,
        current_date + INTERVAL '8 hours',
        'OPEN'
      ) RETURNING id INTO shift_id;
      
      -- Generar ventas (10-20 por día por tienda)
      sales_per_day := FLOOR(RANDOM() * 11 + 10)::INTEGER;
      
      FOR i IN 1..sales_per_day LOOP
        -- 70% efectivo, 30% crédito
        IF RANDOM() < 0.7 THEN
          payment_type := 'CASH';
        ELSE
          payment_type := 'CREDIT';
        END IF;
        
        sale_total := 0;
        
        -- Crear venta
        INSERT INTO sales (
          sale_number,
          client_id,
          user_id,
          store_id,
          total_amount,
          payment_type,
          status,
          created_at
        ) VALUES (
          'V-' || TO_CHAR(current_date, 'YYYYMMDD') || '-' || store_id || '-' || LPAD(i::TEXT, 4, '0'),
          client_ids[FLOOR(RANDOM() * ARRAY_LENGTH(client_ids, 1) + 1)],
          admin_user_id,
          store_id,
          0,
          payment_type,
          'COMPLETED',
          current_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
        ) RETURNING id INTO sale_id;
        
        -- Agregar items (1-4 productos por venta)
        num_items := FLOOR(RANDOM() * 4 + 1)::INTEGER;
        FOR j IN 1..num_items LOOP
          product_id := product_ids[FLOOR(RANDOM() * ARRAY_LENGTH(product_ids, 1) + 1)];
          quantity := FLOOR(RANDOM() * 3 + 1)::INTEGER;
          SELECT sale_price INTO unit_price FROM products WHERE id = product_id;
          subtotal := unit_price * quantity;
          
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
          VALUES (sale_id, product_id, quantity, unit_price, subtotal);
          
          sale_total := sale_total + subtotal;
        END LOOP;
        
        -- Actualizar total de venta
        UPDATE sales SET total_amount = sale_total WHERE id = sale_id;
        
        -- Si es efectivo, sumar a ventas del día
        IF payment_type = 'CASH' THEN
          daily_cash_sales := daily_cash_sales + sale_total;
        END IF;
        
        -- Si es crédito, crear plan de crédito
        IF payment_type = 'CREDIT' THEN
          installment_count := CASE 
            WHEN sale_total < 500 THEN 3
            WHEN sale_total < 1000 THEN 6
            ELSE 12
          END;
          
          installment_amount := sale_total / installment_count;
          
          INSERT INTO credit_plans (
            client_id,
            sale_id,
            total_amount,
            installment_count,
            installment_amount,
            start_date,
            status
          ) VALUES (
            (SELECT client_id FROM sales WHERE id = sale_id),
            sale_id,
            sale_total,
            installment_count,
            installment_amount,
            current_date,
            'ACTIVE'
          ) RETURNING id INTO plan_id;
          
          -- Crear cuotas
          FOR k IN 1..installment_count LOOP
            due_date := current_date + (k * INTERVAL '1 month');
            
            IF due_date < CURRENT_DATE THEN
              inst_status := 'OVERDUE';
            ELSE
              inst_status := 'PENDING';
            END IF;
            
            INSERT INTO installments (
              credit_plan_id,
              installment_number,
              amount,
              due_date,
              status
            ) VALUES (
              plan_id,
              k,
              installment_amount,
              due_date,
              inst_status
            );
          END LOOP;
          
          -- Actualizar credit_used del cliente
          UPDATE clients 
          SET credit_used = credit_used + sale_total 
          WHERE id = (SELECT client_id FROM sales WHERE id = sale_id);
        END IF;
      END LOOP;
      
      -- Generar gastos (0-3 por turno)
      FOR i IN 1..FLOOR(RANDOM() * 4)::INTEGER LOOP
        expense_amount := FLOOR(RANDOM() * 100 + 20)::DECIMAL(10,2);
        daily_expenses := daily_expenses + expense_amount;
        
        INSERT INTO cash_expenses (
          shift_id,
          user_id,
          amount,
          category,
          description,
          created_at
        ) VALUES (
          shift_id,
          admin_user_id,
          expense_amount,
          (ARRAY['SERVICIOS', 'MANTENIMIENTO', 'SUMINISTROS', 'TRANSPORTE', 'OTROS'])[FLOOR(RANDOM() * 5 + 1)],
          'Gasto operativo',
          current_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
        );
      END LOOP;
      
      -- Cerrar turno
      closing_amount := opening_amount + daily_cash_sales - daily_expenses;
      
      UPDATE cash_shifts
      SET 
        closing_amount = closing_amount,
        expected_amount = closing_amount,
        difference = 0,
        closed_at = current_date + INTERVAL '20 hours',
        status = 'CLOSED'
      WHERE id = shift_id;
      
    END LOOP;
    
    -- Siguiente día
    current_date := current_date + INTERVAL '1 day';
    
    -- Mostrar progreso cada 10 días
    IF EXTRACT(DAY FROM current_date)::INTEGER % 10 = 0 THEN
      RAISE NOTICE 'Procesado hasta: %', current_date;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Datos generados exitosamente';
  
  -- ============================================================================
  -- 5. ACTUALIZAR LAST_PURCHASE_DATE DE CLIENTES
  -- ============================================================================
  
  UPDATE clients SET last_purchase_date = (
    SELECT MAX(created_at::date)
    FROM sales
    WHERE sales.client_id = clients.id
  );
  
  RAISE NOTICE 'Last purchase dates actualizados';
  RAISE NOTICE '✅ DATOS CARGADOS EXITOSAMENTE';
  RAISE NOTICE '📊 Revisa el resumen abajo para verificar los datos';
  
END $$;

-- ============================================================================
-- RESUMEN DE DATOS GENERADOS
-- ============================================================================

SELECT 
  'Clientes' as tabla,
  COUNT(*) as registros
FROM clients
UNION ALL
SELECT 'Productos', COUNT(*) FROM products
UNION ALL
SELECT 'Ventas', COUNT(*) FROM sales
UNION ALL
SELECT 'Items de Venta', COUNT(*) FROM sale_items
UNION ALL
SELECT 'Planes de Crédito', COUNT(*) FROM credit_plans
UNION ALL
SELECT 'Cuotas', COUNT(*) FROM installments
UNION ALL
SELECT 'Turnos de Caja', COUNT(*) FROM cash_shifts
UNION ALL
SELECT 'Gastos de Caja', COUNT(*) FROM cash_expenses;

-- Ventas por mes y tienda
SELECT 
  TO_CHAR(created_at, 'YYYY-MM') as mes,
  store_id as tienda,
  COUNT(*) as num_ventas,
  SUM(total_amount) as total_ventas
FROM sales
GROUP BY TO_CHAR(created_at, 'YYYY-MM'), store_id
ORDER BY mes, tienda;
