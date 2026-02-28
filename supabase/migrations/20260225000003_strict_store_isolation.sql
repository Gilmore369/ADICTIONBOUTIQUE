-- Migration: Strict store isolation in decrement_stock
-- Problem: decrement_stock fallback in 20260225000002 allowed cross-store deductions:
--          a sale on "Mujeres" could deduct stock from "Hombres" if the exact
--          warehouse_id string didn't match (e.g. 'TIENDA_MUJERES' vs 'Mujeres').
-- Solution: Remove cross-store fallback. Use case-insensitive exact match only.
--           The POS now sends 'Mujeres'/'Hombres' matching actual warehouse_id values.
--           If a product has no stock in the selected store → raise a clear error.

CREATE OR REPLACE FUNCTION decrement_stock(
  p_warehouse_id TEXT,
  p_product_id   UUID,
  p_quantity     INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_stock  INTEGER;
  v_warehouse_id   TEXT;
BEGIN
  -- Case-insensitive exact match on the specified warehouse only (no cross-store fallback)
  SELECT quantity, warehouse_id
    INTO v_current_stock, v_warehouse_id
    FROM stock
   WHERE product_id    = p_product_id
     AND LOWER(warehouse_id) = LOWER(p_warehouse_id)
   ORDER BY quantity DESC
   LIMIT 1
     FOR UPDATE;

  -- No stock row found in this specific store
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no tiene stock registrado en la tienda "%"', p_product_id, p_warehouse_id;
  END IF;

  -- Validate sufficient quantity
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente en "%": disponible %, solicitado %',
      v_warehouse_id, v_current_stock, p_quantity;
  END IF;

  -- Decrement stock in the matched warehouse
  UPDATE stock
     SET quantity     = quantity - p_quantity,
         last_updated = NOW()
   WHERE warehouse_id = v_warehouse_id
     AND product_id   = p_product_id;

  -- Log movement with the resolved warehouse_id
  INSERT INTO movements (warehouse_id, product_id, type, quantity, created_at)
  VALUES (v_warehouse_id, p_product_id, 'SALIDA', -p_quantity, NOW());

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION decrement_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_stock TO service_role;
