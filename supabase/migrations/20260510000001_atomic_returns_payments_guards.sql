-- ============================================================================
-- Atomic returns/payments guards
-- ============================================================================
-- This migration is intentionally idempotent. Run it in Supabase before deploy
-- so the Next.js actions can use the transactional RPCs instead of multi-step
-- client-side writes.

-- Safer return numbers under concurrency. The previous MAX()+1 function can
-- race when two returns are created at the same time.
CREATE SEQUENCE IF NOT EXISTS public.return_number_seq;

DO $$
DECLARE
  v_max_num integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(return_number, '\D', '', 'g'), '')::integer), 0)
  INTO v_max_num
  FROM public.returns;

  PERFORM setval('public.return_number_seq', GREATEST(v_max_num, 1), true);
END $$;

CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'DEV-' || LPAD(nextval('public.return_number_seq')::text, 4, '0');
END;
$$;

-- Prevent exact duplicate return lines for active returns. This is a trigger,
-- not a unique index, because returned_items is JSONB.
CREATE OR REPLACE FUNCTION public.validate_return_quantities()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_item jsonb;
  v_sale_item_id uuid;
  v_product_id uuid;
  v_qty numeric;
  v_sold numeric;
  v_already_returned numeric;
BEGIN
  IF NEW.status = 'RECHAZADA' THEN
    RETURN NEW;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.returned_items, '[]'::jsonb))
  LOOP
    v_sale_item_id := NULLIF(v_item->>'sale_item_id', '')::uuid;
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qty := COALESCE(NULLIF(v_item->>'quantity', '')::numeric, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'La cantidad devuelta debe ser mayor que cero';
    END IF;

    IF v_sale_item_id IS NOT NULL THEN
      SELECT quantity
      INTO v_sold
      FROM public.sale_items
      WHERE id = v_sale_item_id
        AND sale_id = NEW.sale_id;

      IF v_sold IS NULL THEN
        RAISE EXCEPTION 'El producto devuelto no pertenece a la venta';
      END IF;

      SELECT COALESCE(SUM((item->>'quantity')::numeric), 0)
      INTO v_already_returned
      FROM public.returns r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.returned_items, '[]'::jsonb)) item
      WHERE r.sale_id = NEW.sale_id
        AND r.id <> COALESCE(NEW.id, gen_random_uuid())
        AND r.status IN ('PENDIENTE', 'APROBADA', 'COMPLETADA')
        AND NULLIF(item->>'sale_item_id', '')::uuid = v_sale_item_id;

      IF v_already_returned + v_qty > v_sold + 0.0001 THEN
        RAISE EXCEPTION 'La devolución excede la cantidad vendida. Vendido: %, ya devuelto: %, nuevo: %',
          v_sold, v_already_returned, v_qty;
      END IF;
    ELSIF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Cada producto devuelto debe incluir product_id o sale_item_id';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_return_quantities ON public.returns;
CREATE TRIGGER trg_validate_return_quantities
BEFORE INSERT OR UPDATE OF returned_items, status
ON public.returns
FOR EACH ROW
EXECUTE FUNCTION public.validate_return_quantities();

CREATE OR REPLACE FUNCTION public.apply_credit_return_adjustment(
  p_sale_id uuid,
  p_return_amount numeric,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan record;
  v_inst record;
  v_remaining numeric := COALESCE(p_return_amount, 0);
  v_outstanding numeric;
  v_new_amount numeric;
  v_paid_total numeric;
  v_new_total numeric;
  v_refund_due numeric := 0;
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
        SET amount = paid_amount,
            status = 'PAID',
            paid_at = COALESCE(paid_at, NOW())
        WHERE id = v_inst.id;
      ELSE
        UPDATE public.installments
        SET amount = 0,
            paid_amount = 0,
            status = 'VOIDED',
            paid_at = NULL
        WHERE id = v_inst.id;
      END IF;
    ELSE
      v_new_amount := ROUND((COALESCE(v_inst.amount, 0) - v_remaining)::numeric, 2);
      UPDATE public.installments
      SET amount = v_new_amount,
          status = CASE
            WHEN COALESCE(paid_amount, 0) >= v_new_amount THEN 'PAID'
            WHEN COALESCE(paid_amount, 0) > 0 THEN 'PARTIAL'
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
    'plan_id', v_plan.id,
    'new_total', v_new_total,
    'paid_total', v_paid_total,
    'refund_due', v_refund_due
  );
END;
$$;

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

  -- Stock and movement are idempotent per return/product.
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

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, entity_name, detail, store, new_values
  ) VALUES (
    p_user_id,
    'UPDATE',
    'return',
    p_return_id,
    v_return.return_number,
    'Devolución completada atómicamente. Stock, caja y crédito validados.',
    v_return.store_id,
    jsonb_build_object(
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
GRANT EXECUTE ON FUNCTION public.apply_credit_return_adjustment(uuid, numeric, uuid) TO authenticated;
