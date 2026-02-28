-- Migration: Atomic Database Functions
-- Description: Creates atomic functions for stock management, credit updates, and sale transactions
-- Requirements: 5.3, 9.7, 11.2, 11.3

-- ============================================================================
-- ATOMIC STOCK DECREMENT FUNCTION
-- ============================================================================

-- Function: decrement_stock
-- Purpose: Atomically decrement stock with row-level locking to prevent race conditions
-- Parameters:
--   p_warehouse_id: Warehouse identifier
--   p_product_id: Product UUID
--   p_quantity: Quantity to decrement
-- Returns: BOOLEAN (true on success, raises exception on failure)
-- Validates: Requirements 5.3, 9.7, 11.2, 11.3

CREATE OR REPLACE FUNCTION decrement_stock(
  p_warehouse_id TEXT,
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Lock row for update to prevent race conditions
  SELECT quantity INTO current_stock
  FROM stock
  WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id
  FOR UPDATE;
  
  -- Check if stock record exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock record not found for warehouse % and product %', p_warehouse_id, p_product_id;
  END IF;
  
  -- Check sufficient stock
  IF current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: available %, requested %', current_stock, p_quantity;
  END IF;
  
  -- Decrement stock
  UPDATE stock
  SET quantity = quantity - p_quantity,
      last_updated = NOW()
  WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;
  
  -- Log movement
  INSERT INTO movements (warehouse_id, product_id, type, quantity, created_at)
  VALUES (p_warehouse_id, p_product_id, 'SALIDA', -p_quantity, NOW());
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decrement_stock IS 'Atomically decrement stock with FOR UPDATE locking to prevent race conditions';

-- ============================================================================
-- ATOMIC CREDIT USED INCREMENT FUNCTION
-- ============================================================================

-- Function: increment_credit_used
-- Purpose: Atomically increment client credit_used with row-level locking
-- Parameters:
--   p_client_id: Client UUID
--   p_amount: Amount to increment
-- Returns: BOOLEAN (true on success, raises exception on failure)
-- Validates: Requirements 5.3, 9.7, 11.2, 11.3

CREATE OR REPLACE FUNCTION increment_credit_used(
  p_client_id UUID,
  p_amount DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  current_credit_used DECIMAL;
  current_credit_limit DECIMAL;
BEGIN
  -- Lock row for update to prevent race conditions
  SELECT credit_used, credit_limit INTO current_credit_used, current_credit_limit
  FROM clients
  WHERE id = p_client_id
  FOR UPDATE;
  
  -- Check if client exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', p_client_id;
  END IF;
  
  -- Check credit limit (optional validation, can be done before calling)
  IF (current_credit_used + p_amount) > current_credit_limit THEN
    RAISE EXCEPTION 'Credit limit exceeded: current %, limit %, requested %', 
      current_credit_used, current_credit_limit, p_amount;
  END IF;
  
  -- Increment credit_used
  UPDATE clients
  SET credit_used = credit_used + p_amount,
      updated_at = NOW()
  WHERE id = p_client_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_credit_used IS 'Atomically increment client credit_used with FOR UPDATE locking';

-- ============================================================================
-- ATOMIC CREDIT USED DECREMENT FUNCTION
-- ============================================================================

-- Function: decrement_credit_used
-- Purpose: Atomically decrement client credit_used with row-level locking (for payments)
-- Parameters:
--   p_client_id: Client UUID
--   p_amount: Amount to decrement
-- Returns: BOOLEAN (true on success, raises exception on failure)
-- Validates: Requirements 7.5

CREATE OR REPLACE FUNCTION decrement_credit_used(
  p_client_id UUID,
  p_amount DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  current_credit_used DECIMAL;
BEGIN
  -- Lock row for update to prevent race conditions
  SELECT credit_used INTO current_credit_used
  FROM clients
  WHERE id = p_client_id
  FOR UPDATE;
  
  -- Check if client exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', p_client_id;
  END IF;
  
  -- Check that decrement won't result in negative credit_used
  IF (current_credit_used - p_amount) < 0 THEN
    RAISE EXCEPTION 'Cannot decrement credit_used below zero: current %, requested %', 
      current_credit_used, p_amount;
  END IF;
  
  -- Decrement credit_used
  UPDATE clients
  SET credit_used = credit_used - p_amount,
      updated_at = NOW()
  WHERE id = p_client_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decrement_credit_used IS 'Atomically decrement client credit_used with FOR UPDATE locking (for payments)';

-- ============================================================================
-- ATOMIC SALE TRANSACTION FUNCTION
-- ============================================================================

-- Function: create_sale_transaction
-- Purpose: Atomically create a complete sale with items, stock decrements, and credit plan
-- Parameters:
--   p_sale_number: Unique sale number
--   p_store_id: Store identifier
--   p_client_id: Client UUID (optional for CONTADO sales)
--   p_user_id: User UUID
--   p_sale_type: 'CONTADO' or 'CREDITO'
--   p_subtotal: Subtotal amount
--   p_discount: Discount amount
--   p_total: Total amount
--   p_items: JSONB array of sale items [{product_id, quantity, unit_price}]
--   p_installments: Number of installments (required for CREDITO sales)
-- Returns: UUID (sale_id on success, raises exception on failure)
-- Validates: Requirements 5.3, 9.7, 11.2, 11.3

CREATE OR REPLACE FUNCTION create_sale_transaction(
  p_sale_number TEXT,
  p_store_id TEXT,
  p_client_id UUID,
  p_user_id UUID,
  p_sale_type TEXT,
  p_subtotal DECIMAL,
  p_discount DECIMAL,
  p_total DECIMAL,
  p_items JSONB,
  p_installments INTEGER
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_plan_id UUID;
  v_item JSONB;
  v_installment_amount DECIMAL;
  v_due_date DATE;
  i INTEGER;
BEGIN
  -- Validate sale type
  IF p_sale_type NOT IN ('CONTADO', 'CREDITO') THEN
    RAISE EXCEPTION 'Invalid sale type: %. Must be CONTADO or CREDITO', p_sale_type;
  END IF;
  
  -- Validate credit sale requirements
  IF p_sale_type = 'CREDITO' THEN
    IF p_client_id IS NULL THEN
      RAISE EXCEPTION 'Credit sales require a client_id';
    END IF;
    IF p_installments IS NULL OR p_installments < 1 OR p_installments > 6 THEN
      RAISE EXCEPTION 'Credit sales require installments between 1 and 6';
    END IF;
  END IF;
  
  -- Insert sale
  INSERT INTO sales (sale_number, store_id, client_id, user_id, sale_type, subtotal, discount, total)
  VALUES (p_sale_number, p_store_id, p_client_id, p_user_id, p_sale_type, p_subtotal, p_discount, p_total)
  RETURNING id INTO v_sale_id;
  
  -- Insert sale items and decrement stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert sale item
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL
    );
    
    -- Decrement stock atomically (will raise exception if insufficient)
    PERFORM decrement_stock(
      p_store_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER
    );
  END LOOP;
  
  -- If credit sale, create credit plan and installments
  IF p_sale_type = 'CREDITO' AND p_installments IS NOT NULL THEN
    v_installment_amount := p_total / p_installments;
    
    -- Insert credit plan
    INSERT INTO credit_plans (sale_id, client_id, total_amount, installments_count, installment_amount)
    VALUES (v_sale_id, p_client_id, p_total, p_installments, v_installment_amount)
    RETURNING id INTO v_plan_id;
    
    -- Create installments with +30 days each
    FOR i IN 1..p_installments LOOP
      v_due_date := CURRENT_DATE + (i * 30);
      
      INSERT INTO installments (plan_id, installment_number, amount, due_date)
      VALUES (v_plan_id, i, v_installment_amount, v_due_date);
    END LOOP;
    
    -- Increment client credit_used atomically (will raise exception if limit exceeded)
    PERFORM increment_credit_used(p_client_id, p_total);
  END IF;
  
  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_sale_transaction IS 'Atomically create a complete sale with items, stock decrements, and optional credit plan';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION decrement_stock TO authenticated;
GRANT EXECUTE ON FUNCTION increment_credit_used TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_credit_used TO authenticated;
GRANT EXECUTE ON FUNCTION create_sale_transaction TO authenticated;

