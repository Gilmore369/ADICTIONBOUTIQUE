-- ============================================================================
-- Migration: Update Sale Transaction Function
-- ============================================================================
-- Actualiza create_sale_transaction para usar recalculate_client_credit_used
-- en lugar de increment_credit_used
-- ============================================================================

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
    
    -- Recalculate client credit_used based on all pending installments
    -- This will be triggered automatically by the trigger, but we call it explicitly for safety
    PERFORM recalculate_client_credit_used(p_client_id);
  END IF;
  
  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_sale_transaction IS 'Atomically create a complete sale with items, stock decrements, and optional credit plan. Uses recalculate_client_credit_used for accurate debt tracking.';
