-- ============================================================================
-- SCRIPT COMPLETO: CARGAR DATOS DE 3 MESES (VERSIÓN CORREGIDA)
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
  line_id UUID;
  supplier_id UUID;
  
  start_date DATE := '2025-12-01';
  end_date DATE := '2026-02-28';
  loop_date DATE;
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
  final_closing_amount DECIMAL;
  
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
  
  i INTEGER;
  j INTEGER;
  k INTEGER;
  
BEGIN
  -- Verificar que existe un usuario admin
  SELECT id INTO admin_user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un usuario admin. Por favor crea un usuario admin primero.';
  END IF;
  
  RAISE NOTICE 'Usando usuario admin: %', admin_user_id;
  
  -- ============================================================================
  -- 1. LIMPIAR DATOS EXISTENTES (en orden correcto para evitar errores FK)
  -- ============================================================================
  
  RAISE NOTICE 'Limpiando datos existentes...';
  
  -- Eliminar en orden inverso de dependencias
  DELETE FROM cash_expenses;
  DELETE FROM cash_shifts;
  DELETE FROM installments;
  DELETE FROM credit_plans;
  DELETE FROM sale_items;
  DELETE FROM sales;
  
  -- Eliminar stock de productos de prueba (evitar ambigüedad con variable product_id)
  DELETE FROM stock s 
  USING products p 
  WHERE s.product_id = p.id 
    AND p.barcode LIKE 'PROD-%';
  
  -- Eliminar movimientos de inventario de productos de prueba
  DELETE FROM movements m
  USING products p
  WHERE m.product_id = p.id
    AND p.barcode LIKE 'PROD-%';
  
  DELETE FROM products WHERE barcode LIKE 'PROD-%';
  DELETE FROM clients WHERE phone LIKE '555-%';
  
  RAISE NOTICE 'Datos existentes eliminados';
  
  -- ============================================================================
  -- 2. CREAR CATÁLOGOS BASE (solo si no existen)
  -- ============================================================================
  
  -- Marcas (insertar solo si no existen)
  INSERT INTO brands (name, active)
  SELECT v.name, v.active
  FROM (VALUES
    ('Nike', true), ('Adidas', true), ('Puma', true), ('Reebok', true), 
    ('New Balance', true), ('Converse', true), ('Vans', true), ('Fila', true)
  ) AS v(name, active)
  WHERE NOT EXISTS (
    SELECT 1 FROM brands b WHERE b.name = v.name
  );
  
  -- Categorías (insertar solo si no existen)
  INSERT INTO categories (name, active)
  SELECT v.name, v.active
  FROM (VALUES
    ('Calzado', true), ('Ropa', true), ('Accesorios', true), ('Deportivo', true)
  ) AS v(name, active)
  WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.name = v.name
  );
  
  -- Tallas (insertar solo si no existen)
  INSERT INTO sizes (name, active)
  SELECT v.name, v.active
  FROM (VALUES
    ('XS', true), ('S', true), ('M', true), ('L', true), ('XL', true), ('XXL', true),
    ('36', true), ('38', true), ('40', true), ('42', true), ('44', true)
  ) AS v(name, active)
  WHERE NOT EXISTS (
    SELECT 1 FROM sizes s WHERE s.name = v.name
  );
  
  -- Líneas (insertar solo si no existen)
  INSERT INTO lines (name, active)
  SELECT v.name, v.active
  FROM (VALUES
    ('Hombres', true), ('Mujeres', true), ('Unisex', true), ('Premium', true)
  ) AS v(name, active)
  WHERE NOT EXISTS (
    SELECT 1 FROM lines l WHERE l.name = v.name
  );
  
  -- Proveedores (insertar solo si no existen)
  INSERT INTO suppliers (name, contact_name, phone, email, active)
  SELECT v.name, v.contact_name, v.phone, v.email, v.active
  FROM (VALUES
    ('Proveedor A', 'Juan Pérez', '555-1001', 'proveedora@email.com', true),
    ('Proveedor B', 'María García', '555-1002', 'proveedorb@email.com', true),
    ('Proveedor C', 'Carlos López', '555-1003', 'proveedorc@email.com', true)
  ) AS v(name, contact_name, phone, email, active)
  WHERE NOT EXISTS (
    SELECT 1 FROM suppliers s WHERE s.name = v.name
  );
  
  RAISE NOTICE 'Catálogos creados';
  
  -- ============================================================================
  -- 3. CREAR CLIENTES (50 clientes) - CON COORDENADAS DE TRUJILLO
  -- ============================================================================
  
  INSERT INTO clients (name, phone, address, credit_limit, credit_used, active, birthday, lat, lng) VALUES
  ('Juan Pérez', '555-1001', 'Av. Principal 123, Trujillo', 3000, 0, true, '1985-03-15', -8.1116, -79.0288),
  ('María García', '555-1002', 'Jr. Comercio 456, Trujillo', 5000, 0, true, '1990-07-22', -8.1050, -79.0350),
  ('Carlos López', '555-1003', 'Calle Lima 789, Trujillo', 2000, 0, true, '1988-12-10', -8.1180, -79.0220),
  ('Ana Martínez', '555-1004', 'Av. Grau 321, Trujillo', 4000, 0, true, '1992-05-18', -8.1200, -79.0400),
  ('Luis Rodríguez', '555-1005', 'Jr. Unión 654, Trujillo', 3500, 0, true, '1987-09-25', -8.1000, -79.0300),
  ('Carmen Fernández', '555-1006', 'Calle Real 987, Trujillo', 2500, 0, true, '1995-01-30', -8.1250, -79.0250),
  ('José González', '555-1007', 'Av. Bolívar 147, Trujillo', 3000, 0, true, '1989-11-12', -8.1100, -79.0450),
  ('Laura Sánchez', '555-1008', 'Jr. Ayacucho 258, Trujillo', 4500, 0, true, '1991-04-08', -8.0950, -79.0280),
  ('Miguel Ramírez', '555-1009', 'Calle Sucre 369, Trujillo', 2000, 0, true, '1993-08-14', -8.1300, -79.0350),
  ('Isabel Torres', '555-1010', 'Av. Arequipa 741, Trujillo', 5000, 0, true, '1986-02-20', -8.1150, -79.0180);
  
  -- Agregar 40 clientes más con coordenadas aleatorias en Trujillo
  i := 11;
  WHILE i <= 50 LOOP
    INSERT INTO clients (name, phone, address, credit_limit, credit_used, active, lat, lng)
    VALUES (
      'Cliente ' || i,
      '555-' || LPAD(i::TEXT, 4, '0'),
      'Dirección ' || i || ', Trujillo',
      (ARRAY[2000, 3000, 4000, 5000])[FLOOR(RANDOM() * 4 + 1)],
      0,
      true,
      -8.1116 + (RANDOM() * 0.04 - 0.02), -- Lat: -8.13 a -8.09 (área de Trujillo)
      -79.0288 + (RANDOM() * 0.04 - 0.02)  -- Lng: -79.05 a -79.01
    );
    i := i + 1;
  END LOOP;
  
  RAISE NOTICE 'Clientes creados: 50';
  
  -- ============================================================================
  -- 4. CREAR PRODUCTOS (100 productos)
  -- ============================================================================
  
  SELECT id INTO brand_id FROM brands LIMIT 1;
  SELECT id INTO category_id FROM categories LIMIT 1;
  SELECT id INTO line_id FROM lines LIMIT 1;
  SELECT id INTO supplier_id FROM suppliers LIMIT 1;
  
  i := 1;
  WHILE i <= 100 LOOP
    INSERT INTO products (
      barcode, name, brand_id, category_id, line_id,
      purchase_price, price, min_stock, active
    ) VALUES (
      'PROD-' || LPAD(i::TEXT, 5, '0'),
      'Producto ' || i,
      brand_id, category_id, line_id,
      50.00 + (i * 2),
      100.00 + (i * 5),
      10,
      true
    );
    i := i + 1;
  END LOOP;
  
  RAISE NOTICE 'Productos creados: 100';
  
  -- ============================================================================
  -- 5. CREAR STOCK INICIAL PARA PRODUCTOS
  -- ============================================================================
  
  -- Insertar stock para cada producto en ambas tiendas
  i := 1;
  WHILE i <= 100 LOOP
    -- Stock para TIENDA_HOMBRES (stock alto para 3 meses de ventas)
    INSERT INTO stock (warehouse_id, product_id, quantity)
    SELECT 
      'TIENDA_HOMBRES',
      id,
      FLOOR(RANDOM() * 200 + 100)::INTEGER  -- 100-300 unidades
    FROM products
    WHERE barcode = 'PROD-' || LPAD(i::TEXT, 5, '0');
    
    -- Stock para TIENDA_MUJERES (stock alto para 3 meses de ventas)
    INSERT INTO stock (warehouse_id, product_id, quantity)
    SELECT 
      'TIENDA_MUJERES',
      id,
      FLOOR(RANDOM() * 200 + 100)::INTEGER  -- 100-300 unidades
    FROM products
    WHERE barcode = 'PROD-' || LPAD(i::TEXT, 5, '0');
    
    i := i + 1;
  END LOOP;
  
  RAISE NOTICE 'Stock inicial creado para 100 productos en 2 tiendas (100-300 unidades cada uno)';
  
  -- ============================================================================
  -- 6. GENERAR VENTAS Y TURNOS DE CAJA (3 MESES)
  -- ============================================================================
  
  -- Obtener IDs de clientes y productos
  SELECT ARRAY_AGG(id) INTO client_ids FROM clients WHERE active = true;
  SELECT ARRAY_AGG(id) INTO product_ids FROM products WHERE active = true;
  
  RAISE NOTICE 'Generando datos desde % hasta %', start_date, end_date;
  
  -- Loop por cada día
  loop_date := start_date;
  WHILE loop_date <= end_date LOOP
    
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
        loop_date + INTERVAL '8 hours',
        'OPEN'
      ) RETURNING id INTO shift_id;
      
      -- Generar ventas (10-20 por día por tienda)
      sales_per_day := FLOOR(RANDOM() * 11 + 10)::INTEGER;
      
      i := 1;
      WHILE i <= sales_per_day LOOP
        -- 70% contado, 30% crédito
        IF RANDOM() < 0.7 THEN
          payment_type := 'CONTADO';
        ELSE
          payment_type := 'CREDITO';
        END IF;
        
        sale_total := 0;
        
        -- Crear venta
        INSERT INTO sales (
          sale_number,
          client_id,
          user_id,
          store_id,
          sale_type,
          subtotal,
          discount,
          total,
          payment_status,
          created_at
        ) VALUES (
          'V-' || TO_CHAR(loop_date, 'YYYYMMDD') || '-' || store_id || '-' || LPAD(i::TEXT, 4, '0'),
          client_ids[FLOOR(RANDOM() * ARRAY_LENGTH(client_ids, 1) + 1)],
          admin_user_id,
          store_id,
          payment_type,
          0,
          0,
          0,
          'PAID',
          loop_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
        ) RETURNING id INTO sale_id;
        
        -- Agregar items (1-4 productos por venta)
        num_items := FLOOR(RANDOM() * 4 + 1)::INTEGER;
        
        j := 1;
        WHILE j <= num_items LOOP
          product_id := product_ids[FLOOR(RANDOM() * ARRAY_LENGTH(product_ids, 1) + 1)];
          quantity := FLOOR(RANDOM() * 3 + 1)::INTEGER;
          SELECT price INTO unit_price FROM products WHERE id = product_id;
          subtotal := unit_price * quantity;
          
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
          VALUES (sale_id, product_id, quantity, unit_price, subtotal);
          
          sale_total := sale_total + subtotal;
          
          -- Crear movimiento de salida de inventario
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
            store_id,
            product_id,
            'SALIDA',
            -quantity,
            'V-' || TO_CHAR(loop_date, 'YYYYMMDD') || '-' || store_id || '-' || LPAD(i::TEXT, 4, '0'),
            'Venta de producto',
            admin_user_id,
            loop_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
          );
          
          -- Actualizar stock usando la función atómica (evita ambigüedad)
          PERFORM decrement_stock(store_id, product_id, quantity);
          
          j := j + 1;
        END LOOP;
        
        -- Actualizar total de venta
        UPDATE sales SET subtotal = sale_total, total = sale_total WHERE id = sale_id;
        
        -- Si es contado, sumar a ventas del día
        IF payment_type = 'CONTADO' THEN
          daily_cash_sales := daily_cash_sales + sale_total;
        END IF;
        
        -- Si es crédito, crear plan de crédito
        IF payment_type = 'CREDITO' THEN
          installment_count := CASE 
            WHEN sale_total < 500 THEN 3
            WHEN sale_total < 1000 THEN 6
            ELSE 6
          END;
          
          installment_amount := sale_total / installment_count;
          
          INSERT INTO credit_plans (
            client_id,
            sale_id,
            total_amount,
            installments_count,
            installment_amount,
            status
          ) VALUES (
            (SELECT client_id FROM sales WHERE id = sale_id),
            sale_id,
            sale_total,
            installment_count,
            installment_amount,
            'ACTIVE'
          ) RETURNING id INTO plan_id;
          
          -- Crear cuotas
          k := 1;
          WHILE k <= installment_count LOOP
            due_date := loop_date + (k * INTERVAL '1 month');
            
            -- Marcar como vencida si la fecha de vencimiento es anterior a hoy
            IF due_date < NOW()::DATE THEN
              inst_status := 'OVERDUE';
            ELSE
              inst_status := 'PENDING';
            END IF;
            
            INSERT INTO installments (
              plan_id,
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
            k := k + 1;
          END LOOP;
          
          -- Actualizar credit_used del cliente
          UPDATE clients 
          SET credit_used = credit_used + sale_total 
          WHERE id = (SELECT client_id FROM sales WHERE id = sale_id);
        END IF;
        
        i := i + 1;
      END LOOP;
      
      -- Generar gastos (0-3 por turno)
      i := 1;
      WHILE i <= FLOOR(RANDOM() * 4)::INTEGER LOOP
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
          loop_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
        );
        i := i + 1;
      END LOOP;
      
      -- Cerrar turno
      final_closing_amount := opening_amount + daily_cash_sales - daily_expenses;
      
      UPDATE cash_shifts
      SET 
        closing_amount = final_closing_amount,
        expected_amount = final_closing_amount,
        difference = 0,
        closed_at = loop_date + INTERVAL '20 hours',
        status = 'CLOSED'
      WHERE id = shift_id;
      
    END LOOP;
    
    -- Siguiente día
    loop_date := loop_date + INTERVAL '1 day';
    
    -- Mostrar progreso cada 10 días
    IF EXTRACT(DAY FROM loop_date)::INTEGER % 10 = 0 THEN
      RAISE NOTICE 'Procesado hasta: %', loop_date;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Datos generados exitosamente';
  
  -- ============================================================================
  -- 7. ACTUALIZAR LAST_PURCHASE_DATE DE CLIENTES
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
  SUM(total) as total_ventas
FROM sales
GROUP BY TO_CHAR(created_at, 'YYYY-MM'), store_id
ORDER BY mes, tienda;
