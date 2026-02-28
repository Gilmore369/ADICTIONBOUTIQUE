-- ============================================================================
-- SIMPLE SEED DATA - Quick Test Data Generation
-- ============================================================================
-- This is a simplified version that creates minimal test data
-- Use this if the full seed script has issues
-- ============================================================================

-- Get the first admin user ID
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user first.';
  END IF;
  
  RAISE NOTICE 'Using admin user ID: %', admin_user_id;
END $$;

-- ============================================================================
-- 1. CREATE 10 TEST CLIENTS
-- ============================================================================

INSERT INTO clients (name, phone, address, credit_limit, credit_used, active) VALUES
('Juan Pérez', '555-1001', 'Calle 1, Ciudad', 2000, 0, true),
('María García', '555-1002', 'Calle 2, Ciudad', 3000, 0, true),
('Carlos López', '555-1003', 'Calle 3, Ciudad', 2000, 0, true),
('Ana Martínez', '555-1004', 'Calle 4, Ciudad', 5000, 0, true),
('Luis Rodríguez', '555-1005', 'Calle 5, Ciudad', 2000, 0, true),
('Carmen Fernández', '555-1006', 'Calle 6, Ciudad', 3000, 0, true),
('José González', '555-1007', 'Calle 7, Ciudad', 2000, 0, true),
('Laura Sánchez', '555-1008', 'Calle 8, Ciudad', 3000, 0, true),
('Miguel Ramírez', '555-1009', 'Calle 9, Ciudad', 5000, 0, true),
('Isabel Torres', '555-1010', 'Calle 10, Ciudad', 2000, 0, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. CREATE BASIC CATALOG DATA
-- ============================================================================

-- Brands
INSERT INTO brands (name) VALUES
('Nike'), ('Adidas'), ('Puma')
ON CONFLICT DO NOTHING;

-- Categories
INSERT INTO categories (name) VALUES
('Calzado'), ('Ropa'), ('Accesorios')
ON CONFLICT DO NOTHING;

-- Sizes
INSERT INTO sizes (name) VALUES
('S'), ('M'), ('L'), ('XL')
ON CONFLICT DO NOTHING;

-- Lines
INSERT INTO lines (name) VALUES
('General'), ('Premium'), ('Deportiva')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. CREATE 20 TEST PRODUCTS
-- ============================================================================

DO $$
DECLARE
  brand_id UUID;
  category_id UUID;
  size_id UUID;
  line_id UUID;
BEGIN
  SELECT id INTO brand_id FROM brands LIMIT 1;
  SELECT id INTO category_id FROM categories LIMIT 1;
  SELECT id INTO size_id FROM sizes LIMIT 1;
  SELECT id INTO line_id FROM lines LIMIT 1;

  INSERT INTO products (code, name, brand_id, category_id, size_id, line_id, cost_price, sale_price, stock, min_stock, active)
  SELECT 
    'PROD-' || LPAD(generate_series::TEXT, 5, '0'),
    'Producto ' || generate_series,
    brand_id,
    category_id,
    size_id,
    line_id,
    50.00 + (generate_series * 5),
    100.00 + (generate_series * 10),
    50,
    10,
    true
  FROM generate_series(1, 20);
END $$;

-- ============================================================================
-- 4. CREATE SAMPLE SALES (Last 7 days)
-- ============================================================================

DO $$
DECLARE
  admin_user_id UUID;
  client_id UUID;
  product_id UUID;
  sale_id UUID;
  day_offset INTEGER;
BEGIN
  SELECT id INTO admin_user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  
  -- Create 5 sales per day for last 7 days
  FOR day_offset IN 0..6 LOOP
    FOR i IN 1..5 LOOP
      -- Get random client and product
      SELECT id INTO client_id FROM clients ORDER BY RANDOM() LIMIT 1;
      SELECT id INTO product_id FROM products ORDER BY RANDOM() LIMIT 1;
      
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
        'V-' || TO_CHAR(CURRENT_DATE - day_offset, 'YYYYMMDD') || '-' || LPAD(i::TEXT, 4, '0'),
        client_id,
        admin_user_id,
        150.00 + (i * 50),
        CASE WHEN i % 2 = 0 THEN 'CASH' ELSE 'CREDIT' END,
        'COMPLETED',
        (CURRENT_DATE - day_offset) + INTERVAL '10 hours'
      ) RETURNING id INTO sale_id;
      
      -- Add sale item
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
      VALUES (sale_id, product_id, 2, 75.00 + (i * 25), 150.00 + (i * 50));
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 5. CREATE SAMPLE CASH SHIFTS (Last 7 days)
-- ============================================================================

DO $$
DECLARE
  admin_user_id UUID;
  day_offset INTEGER;
  store_id TEXT;
BEGIN
  SELECT id INTO admin_user_id FROM users WHERE 'admin' = ANY(roles) LIMIT 1;
  
  -- Create shifts for 3 stores for last 7 days
  FOR day_offset IN 0..6 LOOP
    FOREACH store_id IN ARRAY ARRAY['TIENDA_1', 'TIENDA_2', 'TIENDA_3'] LOOP
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
        admin_user_id,
        500.00,
        1200.00 + (day_offset * 100),
        1200.00 + (day_offset * 100),
        0,
        (CURRENT_DATE - day_offset) + INTERVAL '8 hours',
        (CURRENT_DATE - day_offset) + INTERVAL '20 hours',
        'CLOSED'
      );
    END LOOP;
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
SELECT 'Cash Shifts', COUNT(*) FROM cash_shifts;

RAISE NOTICE 'Simple seed data created successfully!';
