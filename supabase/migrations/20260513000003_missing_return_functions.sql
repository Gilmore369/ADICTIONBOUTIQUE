-- ============================================================================
-- MIGRACIÓN: funciones necesarias para completar devoluciones
-- 20260513000003_missing_return_functions.sql
--
-- Estas funciones estaban en 20260504000003 y 20260510000001 pero nunca
-- fueron aplicadas en Supabase producción.
-- ============================================================================

SET search_path = public, pg_temp;

-- ── 1. increment_stock ────────────────────────────────────────────────────────
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

-- ── 2. apply_credit_return_adjustment ─────────────────────────────────────────
-- Reduce installments desde la última hacia atrás y actualiza el plan.
CREATE OR REPLACE FUNCTION public.apply_credit_return_adjustment(
  p_sale_id      uuid,
  p_return_amount numeric,
  p_user_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan        record;
  v_inst        record;
  v_remaining   numeric := COALESCE(p_return_amount, 0);
  v_outstanding numeric;
  v_new_amount  numeric;
  v_paid_total  numeric;
  v_new_total   numeric;
  v_refund_due  numeric := 0;
BEGIN
  SELECT *
  INTO v_plan
  FROM public.credit_plans
  WHERE sale_id = p_sale_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_plan.id IS NULL OR v_remaining <= 0 THEN
    RETURN jsonb_build_object('plan_id', NULL, 'refund_due', 0);
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_paid_total
  FROM public.payments p
  WHERE p.plan_id = v_plan.id;

  -- Reducir cuotas de la última a la primera
  FOR v_inst IN
    SELECT *
    FROM public.installments
    WHERE plan_id = v_plan.id
      AND status IN ('PENDING', 'PARTIAL', 'OVERDUE')
    ORDER BY installment_number DESC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0.0001;
    v_outstanding := GREATEST(0, COALESCE(v_inst.amount, 0) - COALESCE(v_inst.paid_amount, 0));

    IF v_remaining >= v_outstanding - 0.0001 THEN
      v_remaining := v_remaining - v_outstanding;
      IF COALESCE(v_inst.paid_amount, 0) > 0 THEN
        UPDATE public.installments
        SET amount = paid_amount, status = 'PAID', paid_at = COALESCE(paid_at, NOW())
        WHERE id = v_inst.id;
      ELSE
        DELETE FROM public.installments
        WHERE id = v_inst.id;
      END IF;
    ELSE
      v_new_amount := ROUND((COALESCE(v_inst.amount, 0) - v_remaining)::numeric, 2);
      UPDATE public.installments
      SET amount = v_new_amount,
          status = CASE
            WHEN COALESCE(paid_amount, 0) >= v_new_amount THEN 'PAID'
            WHEN COALESCE(paid_amount, 0) > 0            THEN 'PARTIAL'
            ELSE status
          END,
          paid_at = CASE
            WHEN COALESCE(paid_amount, 0) >= v_new_amount THEN COALESCE(paid_at, NOW())
            ELSE paid_at
          END
      WHERE id = v_inst.id;
      v_remaining := 0;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_new_total
  FROM public.installments
  WHERE plan_id = v_plan.id
    AND status <> 'VOIDED';

  UPDATE public.credit_plans
  SET total_amount = v_new_total,
      status = CASE
        WHEN v_new_total <= 0.0001 THEN 'CANCELLED'
        WHEN NOT EXISTS (
          SELECT 1 FROM public.installments
          WHERE plan_id = v_plan.id
            AND status IN ('PENDING', 'PARTIAL', 'OVERDUE')
        ) THEN 'COMPLETED'
        ELSE 'ACTIVE'
      END
  WHERE id = v_plan.id;

  IF v_paid_total > v_new_total THEN
    v_refund_due := ROUND((v_paid_total - v_new_total)::numeric, 2);
  END IF;

  PERFORM public.recalculate_client_credit_used(v_plan.client_id);

  RETURN jsonb_build_object(
    'plan_id',    v_plan.id,
    'new_total',  v_new_total,
    'paid_total', v_paid_total,
    'refund_due', v_refund_due
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.increment_stock(TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_credit_return_adjustment(uuid, numeric, uuid) TO authenticated;
