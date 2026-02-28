-- ============================================================================
-- SEED DATA: 3 MONTHS (December 2025 - February 2026)
-- ============================================================================
-- This script generates realistic test data for:
-- - Clients
-- - Products
-- - Sales (cash and credit)
-- - Credit plans and installments
-- - Payments
-- - Cash shifts and expenses
-- ============================================================================

-- Clean existing data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE cash_expenses, cash_shifts, payments, installments, credit_plans, sale_items, sales, clients, products CASCADE;

-- ============================================================================
-- 1. CREATE TEST CLIENTS (50 clients)
-- ============================================================================

DO $$
DECLARE
  client_names TEXT[] := ARRAY[
    'Juan Pérez', 'María García', 'Carlos López', 'Ana Martínez', 'Luis Rodríguez',
    'Carmen Fernández', 'José González', 'Laura Sánchez', 'Miguel Ramírez', 'Isabel Torres',
    'Francisco Flores', 'Patricia Morales', 'Antonio Jiménez', 'Rosa Ruiz', 'Manuel Hernández',
    'Teresa Díaz', 'Pedro Álvarez', 'Lucía Romero', 'Javier Navarro', 'Marta Gutiérrez',
    'Roberto Castro', 'Elena Ortiz', 'Fernando Rubio', 'Cristina Molina', 'Alberto Serrano',
    'Silvia Blanco', 'Raúl Moreno', 'Pilar Muñoz', 'Sergio Alonso', 'Beatriz Gil',
    'Andrés Gómez', 'Natalia Vázquez', 'Diego Ramos', 'Julia Méndez', 'Pablo Iglesias',
    'Mónica Herrera', 'Óscar Medina', 'Verónica Garrido', 'Adrián Cortés', 'Sandra Castillo',
    'Rubén Delgado', 'Lorena Ortega', 'Iván Marín', 'Claudia Sanz', 'Marcos Núñez',
    'Alicia Prieto', 'Víctor Cano', 'Raquel Pascual', 'Gonzalo Vega', 'Irene Domínguez'
  ];
  client_id UUID;
  i INTEGER;
BEGIN
  FOR i IN 1..50 LOOP
    INSERT INTO clients (
      name,
      phone,
      address,
      credit_limit,
      credit_used,
      active,
      created_at
    ) VALUES (
      client_names[i],
      '555-' || LPAD((1000 + i)::TEXT, 4, '0'),
      'Calle ' || i || ', Ciudad',
      CASE 
        WHEN i % 5 = 0 THEN 5000
        WHEN i % 3 = 0 THEN 3000
        ELSE 2000
      END,
      0,
      true,
      NOW() - INTERVAL '6 months'
    );
  END LOOP;
END $$;

-- ============================================================================
-- 2. CREATE TEST PRODUCTS (100 products)
-- ============================================================================

DO $$
DECLARE
  product_names TEXT[] := ARRAY[
    'Zapatillas Deportivas', 'Pantalón Jean', 'Camisa Casual', 'Vestido Elegante', 'Chaqueta Invierno',
    'Blusa Floral', 'Short Deportivo', 'Falda Plisada', 'Suéter Lana', 'Polo Básico',
    'Zapatos Formales', 'Sandalias Verano', 'Botas Cuero', 'Tenis Running', 'Mocasines',
    'Bufanda Lana', 'Gorra Deportiva', 'Cinturón Cuero', 'Cartera Mujer', 'Mochila Escolar',
    'Reloj Digital', 'Gafas Sol', 'Billetera Hombre', 'Pañuelo Seda', 'Guantes Invierno'
  ];
  brands TEXT[] := ARRAY['Nike', 'Adidas', 'Puma', 'Reebok', 'New Balance', 'Converse', 'Vans'];
  categories TEXT[] := ARRAY['Calzado', 'Ropa', 'Accesorios'];
  sizes TEXT[] := ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  
  brand_id UUID;
  category_id UUID;
  size_id UUID;
  line_id UUID;
  i INTEGER;
  base_price DECIMAL;
BEGIN
  -- Get or create brand
  SELECT id INTO brand_id FROM brands WHERE name = brands[1] LIMIT 1;
  IF brand_id IS NULL THEN
    INSERT INTO brands (name) VALUES (brands[1]) RETURNING id INTO brand_id;
  END IF;

  -- Get or create category
  SELECT id INTO category_id FROM categories WHERE name = categories[1] LIMIT 1;
  IF category_id IS NULL THEN
    INSERT INTO categories (name) VALUES (categories[1]) RETURNING id INTO category_id;
  END IF;

  -- Get or create size
  SELECT id INTO size_id FROM sizes WHERE name = sizes[3] LIMIT 1;
  IF size_id IS NULL THEN
    INSERT INTO sizes (name) VALUES (sizes[3]) RETURNING id INTO size_id;
  END IF;

  -- Get or create line
  SELECT id INTO line_id FROM lines WHERE name = 'General' LIMIT 1;
  IF line_id IS NULL THEN
    INSERT INTO lines (name) VALUES ('General') RETURNING id INTO line_id;
  END IF;

  FOR i IN 1..100 LOOP
    base_price := (RANDOM() * 150 + 50)::DECIMAL(10,2);
    
    INSERT INTO products (
      code,
      name,
      brand_id,
      category_id,
      size_id,
      line_id,
      cost_price,
      sale_price,
      stock,
      min_stock,
      active
    ) VALUES (
      'PROD-' || LPAD(i::TEXT, 5, '0'),
      product_names[(i % 25) + 1] || ' ' || brands[(i % 7) + 1],
      brand_id,
      category_id,
      size_id,
      line_id,
      base_price * 0.6,
      base_price,
      FLOOR(RANDOM() * 100 + 20),
      10,
      true
    );
  END LOOP;
END $$;

-- ============================================================================
-- 3. GENERATE SALES DATA (December 2025 - February 2026)
-- ============================================================================

DO $$
DECLARE
  start_date DATE := '2025-12-01';
  end_date DATE := '2026-02-28';
  current_date DATE;
  sales_per_day INTEGER;
  client_ids UUID[];
  product_ids UUID[];
  user_id UUID;
  
  sale_id UUID;
  client_id UUID;
  product_id UUID;
  quantity INTEGER;
  unit_price DECIMAL;
  total_amount DECIMAL;
  payment_type TEXT;
  
  i INTEGER;
  j INTEGER;
BEGIN
  -- Get user ID (first admin user)
  SELECT id INTO user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  
  -- Get all client and product IDs
  SELECT ARRAY_AGG(id) INTO client_ids FROM clients WHERE active = true;
  SELECT ARRAY_AGG(id) INTO product_ids FROM products WHERE active = true;

  -- Loop through each day
  current_date := start_date;
  WHILE current_date <= end_date LOOP
    -- Random sales per day (5-15)
    sales_per_day := FLOOR(RANDOM() * 11 + 5)::INTEGER;
    
    FOR i IN 1..sales_per_day LOOP
      -- Random client
      client_id := client_ids[FLOOR(RANDOM() * ARRAY_LENGTH(client_ids, 1) + 1)];
      
      -- Random payment type (70% cash, 30% credit)
      IF RANDOM() < 0.7 THEN
        payment_type := 'CASH';
      ELSE
        payment_type := 'CREDIT';
      END IF;
      
      -- Create sale
      INSERT INTO sales (
        sale_number,
        client_id,
        user_id,
        total_amount,
        payment_type,
        status,
        created_at
      ) VALUES (
        'V-' || TO_CHAR(current_date, 'YYYYMMDD') || '-' || LPAD(i::TEXT, 4, '0'),
        client_id,
        user_id,
        0, -- Will be updated
        payment_type,
        'COMPLETED',
        current_date + (RANDOM() * INTERVAL '12 hours' + INTERVAL '8 hours')
      ) RETURNING id INTO sale_id;
      
      -- Add 1-4 items to sale
      total_amount := 0;
      FOR j IN 1..(FLOOR(RANDOM() * 4 + 1)::INTEGER) LOOP
        product_id := product_ids[FLOOR(RANDOM() * ARRAY_LENGTH(product_ids, 1) + 1)];
        quantity := FLOOR(RANDOM() * 3 + 1)::INTEGER;
        
        SELECT sale_price INTO unit_price FROM products WHERE id = product_id;
        
        INSERT INTO sale_items (
          sale_id,
          product_id,
          quantity,
          unit_price,
          subtotal
        ) VALUES (
          sale_id,
          product_id,
          quantity,
          unit_price,
          unit_price * quantity
        );
        
        total_amount := total_amount + (unit_price * quantity);
      END LOOP;
      
      -- Update sale total
      UPDATE sales SET total_amount = total_amount WHERE id = sale_id;
      
      -- If credit sale, create credit plan
      IF payment_type = 'CREDIT' THEN
        DECLARE
          plan_id UUID;
          installment_count INTEGER;
          installment_amount DECIMAL;
          due_date DATE;
        BEGIN
          installment_count := CASE 
            WHEN total_amount < 500 THEN 3
            WHEN total_amount < 1000 THEN 6
            ELSE 12
          END;
          
          installment_amount := total_amount / installment_count;
          
          INSERT INTO credit_plans (
            client_id,
            sale_id,
            total_amount,
            installment_count,
            installment_amount,
            start_date,
            status
          ) VALUES (
            client_id,
            sale_id,
            total_amount,
            installment_count,
            installment_amount,
            current_date,
            'ACTIVE'
          ) RETURNING id INTO plan_id;
          
          -- Create installments
          FOR j IN 1..installment_count LOOP
            due_date := current_date + (j * INTERVAL '1 month');
            
            INSERT INTO installments (
              credit_plan_id,
              installment_number,
              amount,
              due_date,
              status
            ) VALUES (
              plan_id,
              j,
              installment_amount,
              due_date,
              CASE 
                WHEN due_date < CURRENT_DATE THEN 'OVERDUE'
                ELSE 'PENDING'
              END
            );
          END LOOP;
          
          -- Update client credit_used
          UPDATE clients 
          SET credit_used = credit_used + total_amount 
          WHERE id = client_id;
        END;
      END IF;
    END LOOP;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END $$;

-- ============================================================================
-- 4. GENERATE CASH SHIFTS (One per day per store)
-- ============================================================================

DO $$
DECLARE
  start_date DATE := '2025-12-01';
  end_date DATE := '2026-02-28';
  current_date DATE;
  stores TEXT[] := ARRAY['TIENDA_HOMBRES', 'TIENDA_MUJERES'];
  store_id TEXT;
  user_id UUID;
  shift_id UUID;
  opening_amount DECIMAL;
  daily_sales DECIMAL;
  daily_expenses DECIMAL;
  closing_amount DECIMAL;
  i INTEGER;
BEGIN
  -- Get user ID
  SELECT id INTO user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  
  current_date := start_date;
  WHILE current_date <= end_date LOOP
    FOREACH store_id IN ARRAY stores LOOP
      opening_amount := 500.00;
      
      -- Get daily sales for this store (simplified - all sales)
      SELECT COALESCE(SUM(total_amount), 0) * (RANDOM() * 0.5 + 0.3)
      INTO daily_sales
      FROM sales
      WHERE DATE(created_at) = current_date
      AND payment_type = 'CASH';
      
      -- Random expenses (0-3 per day)
      daily_expenses := 0;
      
      -- Calculate closing amount
      closing_amount := opening_amount + daily_sales - daily_expenses;
      
      -- Create shift
      INSERT INTO cash_shifts (
        store_id,
        user_id,
        opening_amount,
        closing_amount,
        expected_amount,
        difference,
        opened_at,
        closed_at,
        status
      ) VALUES (
        store_id,
        user_id,
        opening_amount,
        closing_amount,
        closing_amount,
        0,
        current_date + INTERVAL '8 hours',
        current_date + INTERVAL '20 hours',
        'CLOSED'
      ) RETURNING id INTO shift_id;
      
      -- Add random expenses (0-3)
      FOR i IN 1..(FLOOR(RANDOM() * 4)::INTEGER) LOOP
        INSERT INTO cash_expenses (
          shift_id,
          user_id,
          amount,
          category,
          description,
          created_at
        ) VALUES (
          shift_id,
          user_id,
          FLOOR(RANDOM() * 100 + 20)::DECIMAL(10,2),
          (ARRAY['SERVICIOS', 'MANTENIMIENTO', 'SUMINISTROS', 'TRANSPORTE', 'OTROS'])[FLOOR(RANDOM() * 5 + 1)],
          'Gasto operativo del día',
          current_date + (RANDOM() * INTERVAL '10 hours' + INTERVAL '9 hours')
        );
      END LOOP;
    END LOOP;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END $$;

-- ============================================================================
-- 5. GENERATE PAYMENTS FOR CREDIT SALES
-- ============================================================================

DO $$
DECLARE
  installment_record RECORD;
  payment_amount DECIMAL;
BEGIN
  -- Pay some installments (60% of overdue and pending)
  FOR installment_record IN 
    SELECT * FROM installments 
    WHERE status IN ('PENDING', 'OVERDUE')
    AND RANDOM() < 0.6
  LOOP
    payment_amount := installment_record.amount;
    
    -- Random partial payments (20% chance)
    IF RANDOM() < 0.2 THEN
      payment_amount := payment_amount * (RANDOM() * 0.5 + 0.3);
    END IF;
    
    INSERT INTO payments (
      installment_id,
      amount,
      payment_method,
      created_at
    ) VALUES (
      installment_record.id,
      payment_amount,
      (ARRAY['CASH', 'TRANSFER', 'CARD'])[FLOOR(RANDOM() * 3 + 1)],
      installment_record.due_date + (RANDOM() * INTERVAL '5 days')
    );
    
    -- Update installment
    UPDATE installments
    SET 
      paid_amount = COALESCE(paid_amount, 0) + payment_amount,
      status = CASE 
        WHEN COALESCE(paid_amount, 0) + payment_amount >= amount THEN 'PAID'
        ELSE 'PARTIAL'
      END
    WHERE id = installment_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  'Clients' as entity,
  COUNT(*) as count
FROM clients
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Sales', COUNT(*) FROM sales
UNION ALL
SELECT 'Credit Plans', COUNT(*) FROM credit_plans
UNION ALL
SELECT 'Installments', COUNT(*) FROM installments
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Cash Shifts', COUNT(*) FROM cash_shifts
UNION ALL
SELECT 'Cash Expenses', COUNT(*) FROM cash_expenses;
