-- Fix: complete_return_atomic referenciaba audit_logs (plural) y columnas inexistentes,
-- causando que TODA llamada a completar devolución reventara.
-- Tabla real es audit_log (singular) con columnas: operation, entity_type, entity_id,
-- old_values, new_values, user_id, timestamp.

CREATE OR REPLACE FUNCTION public.complete_return_atomic(
  p_return_id uuid,
  p_user_id uuid,
  p_refund_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_return record;
  v_sale record;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_refund_amount numeric;
  v_shift_id uuid;
  v_cash_expense_id uuid;
  v_existing_movement uuid;
  v_credit jsonb := '{}'::jsonb;
  v_cash_refund_amount numeric := 0;
  v_ref text;
BEGIN
  SELECT *
  INTO v_return
  FROM public.returns
  WHERE id = p_return_id
  FOR UPDATE;

  IF v_return.id IS NULL THEN
    RAISE EXCEPTION 'Devolución no encontrada';
  END IF;

  IF v_return.status <> 'APROBADA' THEN
    RAISE EXCEPTION 'Solo se pueden completar devoluciones APROBADAS. Estado actual: %', v_return.status;
  END IF;

  SELECT id, sale_type, store_id, sale_number
  INTO v_sale
  FROM public.sales
  WHERE id = v_return.sale_id;

  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venta original no encontrada';
  END IF;

  v_refund_amount := COALESCE(p_refund_amount, v_return.total_amount, 0);
  v_ref := 'Devolución ' || v_return.return_number;

  -- Stock and movement idempotent per return/product.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_return.returned_items, '[]'::jsonb))
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qty := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);

    IF v_product_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id
    INTO v_existing_movement
    FROM public.movements
    WHERE product_id = v_product_id
      AND warehouse_id = v_return.store_id
      AND reference = v_ref
    LIMIT 1;

    IF v_existing_movement IS NULL THEN
      PERFORM public.increment_stock(v_return.store_id, v_product_id, v_qty);

      INSERT INTO public.movements (
        warehouse_id, product_id, type, quantity, reference, notes, user_id
      ) VALUES (
        v_return.store_id,
        v_product_id,
        'ENTRADA',
        v_qty,
        v_ref,
        'Ingreso por devolución completada de venta ' || COALESCE(v_return.sale_number, v_sale.sale_number),
        p_user_id
      );
    END IF;
  END LOOP;

  IF v_sale.sale_type = 'CREDITO' THEN
    v_credit := public.apply_credit_return_adjustment(v_return.sale_id, v_refund_amount, p_user_id);
    v_cash_refund_amount := COALESCE((v_credit->>'refund_due')::numeric, 0);
    IF v_cash_refund_amount > v_refund_amount THEN
      v_cash_refund_amount := v_refund_amount;
    END IF;
  ELSE
    v_cash_refund_amount := v_refund_amount;
  END IF;

  IF v_cash_refund_amount > 0 THEN
    SELECT id
    INTO v_cash_expense_id
    FROM public.cash_expenses
    WHERE category = 'DEVOLUCION'
      AND description ILIKE '%' || v_return.return_number || '%'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_cash_expense_id IS NULL THEN
      SELECT id
      INTO v_shift_id
      FROM public.cash_shifts
      WHERE store_id = v_return.store_id
        AND status = 'OPEN'
      ORDER BY opened_at DESC
      LIMIT 1
      FOR UPDATE;

      IF v_shift_id IS NULL THEN
        RAISE EXCEPTION 'No hay caja abierta en %. Abre caja antes de completar la devolución.', v_return.store_id;
      END IF;

      INSERT INTO public.cash_expenses (
        shift_id, amount, category, description, user_id
      ) VALUES (
        v_shift_id,
        v_cash_refund_amount,
        'DEVOLUCION',
        'Reembolso devolución ' || v_return.return_number || ' - venta ' || COALESCE(v_return.sale_number, v_sale.sale_number),
        p_user_id
      )
      RETURNING id INTO v_cash_expense_id;
    END IF;
  END IF;

  UPDATE public.returns
  SET status = 'COMPLETADA',
      refund_amount = v_refund_amount
  WHERE id = p_return_id;

  -- FIX: audit_log (singular) con columnas correctas
  INSERT INTO public.audit_log (
    user_id, operation, entity_type, entity_id, new_values
  ) VALUES (
    p_user_id,
    'UPDATE',
    'return',
    p_return_id,
    jsonb_build_object(
      'return_number', v_return.return_number,
      'store', v_return.store_id,
      'detail', 'Devolución completada atómicamente. Stock, caja y crédito validados.',
      'status', 'COMPLETADA',
      'sale_type', v_sale.sale_type,
      'refund_amount', v_refund_amount,
      'cash_refund_amount', v_cash_refund_amount,
      'cash_expense_id', v_cash_expense_id,
      'credit', v_credit
    )
  );

  RETURN jsonb_build_object(
    'return_id', p_return_id,
    'status', 'COMPLETADA',
    'sale_type', v_sale.sale_type,
    'cash_expense_id', v_cash_expense_id,
    'cash_refund_amount', v_cash_refund_amount,
    'credit', v_credit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_return_atomic(uuid, uuid, numeric) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Reparación data V-0001 (María García López):
-- Plan estaba corrupto en 80 con cuota 1=10, cuota 2=70 (suma 80 ≠ venta 140).
-- Devolución sigue APROBADA (no COMPLETADA), por lo tanto el plan debe
-- estar en su estado original: 140 con 2 cuotas de 70.
-- ─────────────────────────────────────────────────────────────────────

UPDATE public.installments
SET amount = 70.00, paid_amount = 0, status = 'PENDING', paid_at = NULL
WHERE plan_id = 'fba3a711-33a9-45ac-98a7-29ffcd6cde01';

UPDATE public.credit_plans
SET total_amount = 140.00, installment_amount = 70.00, status = 'ACTIVE'
WHERE id = 'fba3a711-33a9-45ac-98a7-29ffcd6cde01';

-- Recalcular credit_used del cliente con la data corregida
SELECT public.recalculate_client_credit_used('aa3275bc-acc0-4bcf-afce-fb5f1f853b76');
