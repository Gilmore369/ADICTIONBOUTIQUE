-- ============================================================================
-- SCRIPT COMPLETO CON STOCK Y MOVIMIENTOS
-- Diciembre 2025 - Febrero 2026
-- ============================================================================

DO $$
DECLARE
  admin_user_id UUID;
  brand_id UUID;
  category_id UUID;
  line_id UUID;
  
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
  
  -- Limpiar datos existentes
  DELETE FROM cash_expenses;
  DELETE FROM cash_shifts;
  DELETE FROM installments;
  DELETE FROM credit_plans;
  DELETE FROM sale_items;
  DELETE FROM sales;
  DELETE FROM movements;
  DELETE FROM stock;
  DELETE FROM clients WHERE phone LIKE '555-%';
  DELETE FROM products WHERE barcode LIKE 'PROD-%';
  
  -- Crear catálogos
  INSERT INTO brands (name, active) VALUES
  ('Nike', true), ('Adidas', true), ('Puma', true), ('Reebok', true)
  ON CONFLICT (name) DO NOTHING;
  
  INSERT INTO categories (name, active) VALUES
  ('Calzado', true), ('Ropa', true), ('Accesorios', true)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO lines (name, active) VALUES
  ('Hombres', true), ('Mujeres', true), ('Unisex', true)
  ON CONFLICT (name) DO NOTHING;
  
  RAISE NOTICE 'Catálogos creados';
  
  -- Crear clientes
  INSERT INTO clients (name, phone, address, credit_limit, credit_used, active) VALUES
  ('Juan Pérez', '555-1001', 'Av. Principal 123', 3000, 0, true),
  ('María García', '555-1002', 'Jr. Comercio 456', 5000, 0, true),
  ('Carlos López', '555-1003', 'Calle Lima 789', 2000, 0, true),
  ('Ana Martínez', '555-1004', 'Av. Grau 321', 4000, 0, true),
  ('Luis Rodríguez', '555-1005', 'Jr. Unión 654', 3500, 0, true);
  
  i := 6;
  WHILE i <= 50 LOOP
    INSERT INTO clients (name, phone, address, credit_limit, credit_used, active)
    VALUES (
      'Cliente ' || i,
      '555-' || LPAD(i::TEXT, 4, '0'),
      'Dirección ' || i,
      (ARRAY[2000, 3000, 4000, 5000])[FLOOR(RANDOM() * 4 + 1)],
      0,
      true
    );
    i := i + 1;
  END LOOP;
  
  RAISE NOTICE 'Clientes creados: 50';
  
  -- Crear productos
  SELECT id INTO brand_id FROM brands LIMIT 1;
  SELECT id INTO category_id FROM categories LIMIT 1;
  SELECT id INTO line_id FROM lines LIMIT 1;
  
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
  
  -- Crear stock inicial
  FOREACH store_id IN ARRAY stores LOOP
    FOR product_id IN SELECT id FROM products WHERE barcode LIKE 'PROD-%' LOOP
      INSERT INTO stock (warehouse_id, product_id, quantity, last_updated)
      VALUES (
        store_id,
        product_id,
        FLOOR(RANDOM() * 100 + 50)::INTEGER,
        start_date - INTERVAL '15 days'
      );
      
      -- Crear movimiento de entrada inicial
      INSERT INTO movements (
        warehouse_id, product_id, type, quantity,
        reference, notes, user_id, created_at
      ) VALUES (
        store_id,
        product_id,
        'ENTRADA',
        FLOOR(RANDOM() * 100 + 50)::INTEGER,
        'COMPRA-INICIAL',
        'Stock inicial',
        admin_user_id,
        start_date - INTERVAL '15 days'
      );
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Stock y movimientos iniciales creados';
  
  -- Obtener IDs
  SELECT ARRAY_AGG(id) INTO client_ids FROM clients WHERE active = true;
  SELECT ARRAY_AGG(id) INTO product_ids FROM products WHERE barcode LIKE 'PROD-%';
  
  -- Generar ventas
  loop_date := start_date;
  WHILE loop_date <= end_date LOOP
    
    FOREACH store_id IN ARRAY stores LOOP
      opening_amount := 500.00;
      daily_cash_sales := 0;
      daily_expenses := 0;
      
      -- Crear turno de caja
      INSERT INTO cash_shifts (
        store_id, user_id, opening_amount, opened_at, status
      ) VALUES (
        store_id, admin_user_id, opening_amount,
        loop_date + INTERVAL '8 hours', 'OPEN'
      ) RETURNING id INTO shift_id;
      
      -- Generar ventas (10-20 por día)
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
          sale_number, client_id, user_id, store_id,
          sale_type, subtotal, discount, total,
          payment_status, created_at
        ) VALUES (
          'V-' || TO_CHAR(loop_date, 'YYYYMMDD') || '-' || store_id || '-' || LPAD(i::TEXT, 4, '0'),
          client_ids[FLOOR(RANDOM() * ARRAY_LENGTH(client_ids, 1) + 1)],
          admin_user_id, store_id, payment_type,
          0, 0, 0, 'PAID',
          loop_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
        ) RETURNING id INTO sale_id;
        
        -- Agregar items (1-4 productos)
        num_items := FLOOR(RANDOM() * 4 + 1)::INTEGER;
        
        j := 1;
        WHILE j <= num_items LOOP
          product_id := product_ids[FLOOR(RANDOM() * ARRAY_LENGTH(product_ids, 1) + 1)];
          quantity := FLOOR(RANDOM() * 3 + 1)::INTEGER;
          SELECT price INTO unit_price FROM products WHERE id = product_id;
          subtotal := unit_price * quantity;
          
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
          VALUES (sale_id, product_id, quantity, unit_price, subtotal);
          
          -- Crear movimiento de salida
          INSERT INTO movements (
            warehouse_id, product_id, type, quantity,
            reference, notes, user_id, created_at
          ) VALUES (
            store_id, product_id, 'SALIDA', -quantity,
            'V-' || TO_CHAR(loop_date, 'YYYYMMDD') || '-' || store_id || '-' || LPAD(i::TEXT, 4, '0'),
            'Venta',
            admin_user_id,
            loop_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
          );
          
          -- Actualizar stock
          UPDATE stock
          SET quantity = quantity - quantity,
              last_updated = loop_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
          WHERE warehouse_id = store_id AND product_id = product_id;
          
          sale_total := sale_total + subtotal;
          j := j + 1;
        END LOOP;
        
        -- Actualizar total de venta
        UPDATE sales SET subtotal = sale_total, total = sale_total WHERE id = sale_id;
        
        -- Si es contado, sumar a ventas del día
        IF payment_type = 'CONTADO' THEN
          daily_cash_sales := daily_cash_sales + sale_total;
        END IF;
        
        -- Si es crédito, crear plan
        IF payment_type = 'CREDITO' THEN
          installment_count := CASE 
            WHEN sale_total < 500 THEN 3
            WHEN sale_total < 1000 THEN 4
            ELSE 6
          END;
          
          installment_amount := sale_total / installment_count;
          
          INSERT INTO credit_plans (
            client_id, sale_id, total_amount,
            installments_count, installment_amount, status
          ) VALUES (
            (SELECT client_id FROM sales WHERE id = sale_id),
            sale_id, sale_total,
            installment_count, installment_amount, 'ACTIVE'
          ) RETURNING id INTO plan_id;
          
          -- Crear cuotas
          k := 1;
          WHILE k <= installment_count LOOP
            due_date := loop_date + (k * INTERVAL '1 month');
            
            IF due_date < NOW()::DATE THEN
              inst_status := 'OVERDUE';
            ELSE
              inst_status := 'PENDING';
            END IF;
            
            INSERT INTO installments (
              plan_id, installment_number, amount, due_date, status
            ) VALUES (
              plan_id, k, installment_amount, due_date, inst_status
            );
            k := k + 1;
          END LOOP;
          
          -- Actualizar credit_used
          UPDATE clients 
          SET credit_used = credit_used + sale_total 
          WHERE id = (SELECT client_id FROM sales WHERE id = sale_id);
        END IF;
        
        i := i + 1;
      END LOOP;
      
      -- Generar gastos
      i := 1;
      WHILE i <= FLOOR(RANDOM() * 4)::INTEGER LOOP
        expense_amount := FLOOR(RANDOM() * 100 + 20)::DECIMAL(10,2);
        daily_expenses := daily_expenses + expense_amount;
        
        INSERT INTO cash_expenses (
          shift_id, user_id, amount, category, description, created_at
        ) VALUES (
          shift_id, admin_user_id, expense_amount,
          (ARRAY['SERVICIOS', 'MANTENIMIENTO', 'SUMINISTROS'])[FLOOR(RANDOM() * 3 + 1)],
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
    
    loop_date := loop_date + INTERVAL '1 day';
    
    IF EXTRACT(DAY FROM loop_date)::INTEGER % 10 = 0 THEN
      RAISE NOTICE 'Procesado hasta: %', loop_date;
    END IF;
  END LOOP;
  
  -- Actualizar last_purchase_date
  UPDATE clients SET last_purchase_date = (
    SELECT MAX(created_at::date)
    FROM sales
    WHERE sales.client_id = clients.id
  );
  
  RAISE NOTICE '✅ DATOS CARGADOS EXITOSAMENTE';
  
END $$;

-- Resumen
SELECT 
  'Clientes' as tabla, COUNT(*) as registros FROM clients
UNION ALL
SELECT 'Productos', COUNT(*) FROM products
UNION ALL
SELECT 'Stock', COUNT(*) FROM stock
UNION ALL
SELECT 'Movimientos', COUNT(*) FROM movements
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
