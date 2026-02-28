-- Migration: Fix decrement_stock to fall back to any warehouse when exact match not found
-- Problem: stock rows may use different warehouse_id values (TEXT codes, UUIDs, etc.)
--          decrement_stock raised EXCEPTION when warehouse_id didn't match exactly,
--          causing all sales to fail.
-- Solution: try exact match first; if not found, decrement from any row that has the product.

CREATE OR REPLACE FUNCTION decrement_stock(
  p_warehouse_id TEXT,
  p_product_id   UUID,
  p_quantity     INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_stock  INTEGER;
  v_warehouse_id   TEXT;
BEGIN
  -- 1. Try exact warehouse_id match (or case-insensitive)
  SELECT quantity, warehouse_id
    INTO v_current_stock, v_warehouse_id
    FROM stock
   WHERE product_id    = p_product_id
     AND (warehouse_id = p_warehouse_id OR warehouse_id ILIKE p_warehouse_id)
   ORDER BY quantity DESC           -- prefer the row with most stock
   LIMIT 1
     FOR UPDATE;

  -- 2. Fallback: any warehouse that has stock for this product
  IF NOT FOUND THEN
    SELECT quantity, warehouse_id
      INTO v_current_stock, v_warehouse_id
      FROM stock
     WHERE product_id = p_product_id
       AND quantity   >= p_quantity
     ORDER BY quantity DESC
     LIMIT 1
       FOR UPDATE;
  END IF;

  -- 3. Still nothing? raise an informative exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay stock disponible para el producto %', p_product_id;
  END IF;

  -- 4. Validate sufficient quantity
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente: disponible %, solicitado %', v_current_stock, p_quantity;
  END IF;

  -- 5. Decrement
  UPDATE stock
     SET quantity     = quantity - p_quantity,
         last_updated = NOW()
   WHERE warehouse_id = v_warehouse_id
     AND product_id   = p_product_id;

  -- 6. Log movement (use resolved warehouse, not the requested one)
  INSERT INTO movements (warehouse_id, product_id, type, quantity, created_at)
  VALUES (v_warehouse_id, p_product_id, 'SALIDA', -p_quantity, NOW());

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION decrement_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_stock TO service_role;
