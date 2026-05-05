-- ============================================================================
-- increment_stock(p_warehouse_id, p_product_id, p_quantity)
-- ============================================================================
-- Counterpart of decrement_stock — used by voidSale() and approveReturnAction
-- to put units back when a sale is annulled or a product is returned.
--
-- Uses SELECT ... FOR UPDATE to serialize concurrent updates on the same row.
-- Inserts a row if the (warehouse, product) pair doesn't have one yet
-- (sale could have used cross-store fallback in older code paths).
-- ============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.increment_stock(
  p_warehouse_id TEXT,
  p_product_id   UUID,
  p_quantity     INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'increment_stock: p_quantity must be > 0 (got %)', p_quantity;
  END IF;

  -- Lock the (warehouse, product) row for the transaction; create if missing.
  PERFORM 1
  FROM public.stock
  WHERE warehouse_id = p_warehouse_id
    AND product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.stock (warehouse_id, product_id, quantity)
    VALUES (p_warehouse_id, p_product_id, p_quantity)
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = public.stock.quantity + EXCLUDED.quantity;
    RETURN;
  END IF;

  UPDATE public.stock
  SET quantity = quantity + p_quantity
  WHERE warehouse_id = p_warehouse_id
    AND product_id = p_product_id;
END;
$$;

COMMENT ON FUNCTION public.increment_stock(TEXT, UUID, INTEGER) IS
  'Atomically returns N units to stock. Used by voidSale and returns flow.';
