-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  MIGRACIONES PENDIENTES — Adiction Boutique                           ║
-- ║                                                                       ║
-- ║  Pega TODO este bloque en Supabase Dashboard → SQL Editor → RUN      ║
-- ║  Es 100% idempotente: si una migración ya se ejecutó antes,           ║
-- ║  no falla ni duplica nada (todas usan IF NOT EXISTS / OR REPLACE).    ║
-- ║                                                                       ║
-- ║  Orden: del archivo más viejo al más nuevo, como en supabase/migr.    ║
-- ╚═══════════════════════════════════════════════════════════════════════╝


-- ============================================================================
-- 📁 20260502000001_drop_cash_shifts_expected_amount_check.sql
-- ============================================================================
-- ============================================================================
-- Drop CHECK (expected_amount >= 0) on cash_shifts
-- ============================================================================
-- The constraint blocked legitimate close operations: when the sum of cash
-- expenses during a shift legitimately exceeds (opening + cash sales +
-- collections), the calculated expected_amount is negative — that's a real
-- business situation (the cashier had to cover expenses out of pocket or out
-- of the next shift's float), not bad data. The negative number IS the
-- diagnostic; clobbering it to NULL or aborting the close is worse.
--
-- Symptom that triggered this:
--   "new row for relation 'cash_shifts' violates check constraint
--    'cash_shifts_expected_amount_check'" — left a Tienda Mujeres shift
--   open since 2026-04-12 because closing kept failing.
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.cash_shifts
  DROP CONSTRAINT IF EXISTS cash_shifts_expected_amount_check;

-- ============================================================================
-- 📁 20260502000002_normalize_installment_paid_status.sql
-- ============================================================================
-- ============================================================================
-- Mark fully-paid installments as PAID
-- ============================================================================
-- Some installments have paid_amount >= amount but status is still PARTIAL or
-- OVERDUE because nothing flipped them to PAID. The debt page rendered those
-- as "vencido" (e.g. Sandra Valeria Ruiz showed "1 venc" with no real debt).
--
-- This is a one-shot data fix. The application code (actions/payments.ts and
-- the credit-plans view) already treats balance == 0 as fully paid, but
-- normalizing the stored status keeps reports / queries that rely on status
-- truthful too.
-- ============================================================================

SET search_path = public, pg_temp;

UPDATE public.installments
SET status = 'PAID'
WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')
  AND COALESCE(paid_amount, 0) >= amount - 0.009;

-- ============================================================================
-- 📁 20260503000001_add_barcode_to_products.sql
-- ============================================================================
-- Migration: Add Barcode Field to Products
-- Description: Adds barcode field with unique constraint for product identification
-- Date: 2026-05-03

SET search_path = public, pg_temp;

-- Add barcode column if it doesn't exist (it should already exist from initial schema)
-- This migration ensures the column exists and has proper constraints

-- Check if barcode column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE products ADD COLUMN barcode TEXT;
  END IF;
END $$;

-- Ensure unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_barcode_key'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_barcode_key UNIQUE (barcode);
  END IF;
END $$;

-- Create index for faster barcode lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Add comment
COMMENT ON COLUMN products.barcode IS 'Unique barcode identifier for product scanning. Can be entered manually or scanned with barcode reader.';

-- Note: The barcode field is optional (nullable) to allow products without barcodes
-- When a barcode is provided, it must be unique across all products

-- ============================================================================
-- 📁 20260504000001_payments_idempotency_key.sql
-- ============================================================================
-- ============================================================================
-- Add idempotency_key to payments
-- ============================================================================
-- Without this, a double-clicked "Registrar pago" button or a network retry
-- can create two payment rows for the same intent and apply the cuota twice.
-- The client now sends a UUID (idempotency_key) per payment attempt; if the
-- DB already has a row with that key, processPayment short-circuits and
-- returns the existing payment instead of re-applying.
--
-- Nullable for backward compatibility — payments inserted by older code paths
-- (and seed data) don't have one. UNIQUE WHERE NOT NULL prevents collisions
-- on real keys without forcing a value on legacy rows.
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_unique
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.payments.idempotency_key IS
  'Client-generated UUID per payment attempt. processPayment uses it to dedupe duplicate submissions (double-click, retry).';

-- ============================================================================
-- 📁 20260504000002_installments_voided_status.sql
-- ============================================================================
-- ============================================================================
-- Allow status='VOIDED' on installments
-- ============================================================================
-- voidSale() needs to mark installments as VOIDED when their parent sale is
-- annulled, so they stop appearing in collections / overdue reports without
-- losing the row (we keep it for audit history).
--
-- The original CHECK constraint only allowed PENDING/PARTIAL/PAID/OVERDUE.
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.installments
  DROP CONSTRAINT IF EXISTS installments_status_check;

ALTER TABLE public.installments
  ADD CONSTRAINT installments_status_check
  CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'VOIDED'));

-- ============================================================================
-- 📁 20260504000003_increment_stock_rpc.sql
-- ============================================================================
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

-- ============================================================================
-- 📁 20260504000004_peek_sale_number_seq.sql
-- ============================================================================
-- ============================================================================
-- peek_sale_number_seq() — read last_value of sale_number_seq without advancing
-- ============================================================================
-- /api/sales/next-number used to read the latest sale and add 1, which races
-- with concurrent inserts and could crash one of two simultaneous POS sales.
--
-- The actual sale number is generated by `generate_sale_number()` (which
-- calls nextval). For UI preview we only need to *peek* at the next value,
-- without burning a number.
-- ============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.peek_sale_number_seq()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- pg_sequences.last_value is the last value handed out by nextval.
  -- If the sequence has never been called, last_value is the start (1).
  SELECT COALESCE(last_value, 0) FROM public.sale_number_seq;
$$;

COMMENT ON FUNCTION public.peek_sale_number_seq() IS
  'Returns the last value emitted by sale_number_seq without advancing it. Used by /api/sales/next-number for read-only UI preview.';

GRANT EXECUTE ON FUNCTION public.peek_sale_number_seq() TO authenticated;

-- ============================================================================
-- 📁 20260505000001_dashboard_metrics_lima_tz.sql
-- ============================================================================
-- ============================================================================
-- Fix: get_dashboard_metrics y get_sales_by_period usaban CURRENT_DATE (UTC)
-- ============================================================================
-- BUG REPORTADO:
--   Dashboard mostraba "6 en mora · S/ 542.04 vencida".
--   Página de Deuda mostraba "4 con cuotas vencidas · S/ 309.54".
--   Los 3 cuotas que se contaban en el dashboard pero NO en la página tenían
--   due_date = '2026-05-05' (hoy en Lima). Como el servidor de Supabase
--   corre en UTC, `CURRENT_DATE` ya era '2026-05-06' a las 22:46 hora Lima
--   (03:46 UTC), así que el RPC las clasificaba como vencidas; el frontend
--   las consideraba "al día" porque usaba la fecha local del navegador.
--
-- CAUSA:
--   `CURRENT_DATE` y `DATE(NOW())` retornan la fecha del servidor (UTC en
--   Supabase). El negocio opera en America/Lima (UTC-5), así que cualquier
--   métrica de "hoy" debe calcularse en esa zona.
--
-- FIX:
--   Reemplazar todas las apariciones de `CURRENT_DATE` y de `NOW()` cuando
--   se usan para definir un día calendario por
--   `(NOW() AT TIME ZONE 'America/Lima')::DATE`.
--   También se arregla `v_sales_today` que tenía el mismo defecto: las
--   ventas hechas entre 19:00 y 23:59 hora Lima caían fuera del "hoy" UTC
--   y se contaban en el día siguiente.
-- ============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_inactivity_days INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_today                    DATE := (NOW() AT TIME ZONE 'America/Lima')::DATE;
  v_result                   JSONB;
  v_total_active             BIGINT;
  v_total_deactivated        BIGINT;
  v_clients_with_debt        BIGINT;
  v_clients_overdue_debt     BIGINT;
  v_inactive_clients         BIGINT;
  v_birthdays_this_month     BIGINT;
  v_pending_actions          BIGINT;
  v_total_outstanding_debt   NUMERIC;
  v_total_overdue_debt       NUMERIC;
  v_sales_today              NUMERIC;
  v_sales_count_today        BIGINT;
  v_sales_this_month         NUMERIC;
  v_low_stock_products       BIGINT;
  v_payments_this_month      NUMERIC;
BEGIN
  -- Clientes activos / inactivos
  SELECT COUNT(*) INTO v_total_active        FROM clients WHERE active = true;
  SELECT COUNT(*) INTO v_total_deactivated   FROM clients WHERE active = false;

  -- Clientes con alguna cuota pendiente (tienen deuda)
  SELECT COUNT(DISTINCT cp.client_id)
  INTO v_clients_with_debt
  FROM credit_plans cp
  JOIN installments i ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND cp.status = 'ACTIVE';

  -- Clientes con al menos una cuota vencida (hora Lima)
  SELECT COUNT(DISTINCT cp.client_id)
  INTO v_clients_overdue_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND i.due_date < v_today
    AND cp.status = 'ACTIVE';

  -- Clientes inactivos (sin compra en N días, hora Lima)
  SELECT COUNT(*)
  INTO v_inactive_clients
  FROM clients
  WHERE active = true
    AND last_purchase_date IS NOT NULL
    AND v_today - last_purchase_date > p_inactivity_days;

  -- Cumpleaños este mes
  SELECT COUNT(*)
  INTO v_birthdays_this_month
  FROM clients
  WHERE active = true
    AND birthday IS NOT NULL
    AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM v_today);

  -- Acciones de cobranza pendientes
  SELECT COUNT(*)
  INTO v_pending_actions
  FROM collection_actions
  WHERE result IN ('PROMESA_PAGO','PENDIENTE','SIN_RESPUESTA','VOLVER_A_LLAMAR');

  -- Total de deuda pendiente (todas las cuotas no pagadas de planes ACTIVE)
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_total_outstanding_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND cp.status = 'ACTIVE';

  -- Total vencido (hora Lima)
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_total_overdue_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND i.due_date < v_today
    AND cp.status = 'ACTIVE';

  -- Ventas de hoy (hora Lima — antes contaba ventas de 19:00 Lima como del día siguiente)
  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_sales_today, v_sales_count_today
  FROM sales
  WHERE voided = false
    AND (created_at AT TIME ZONE 'America/Lima')::DATE = v_today;

  -- Ventas este mes (hora Lima)
  SELECT COALESCE(SUM(total), 0)
  INTO v_sales_this_month
  FROM sales
  WHERE voided = false
    AND DATE_TRUNC('month', created_at AT TIME ZONE 'America/Lima')
        = DATE_TRUNC('month', v_today::TIMESTAMP);

  -- Productos con stock bajo
  SELECT COUNT(*)
  INTO v_low_stock_products
  FROM (
    SELECT p.id
    FROM products p
    JOIN stock sk ON sk.product_id = p.id
    WHERE p.active = true
    GROUP BY p.id, p.min_stock
    HAVING SUM(sk.quantity) <= p.min_stock
  ) low_stock_sub;

  -- Pagos recibidos este mes (hora Lima)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_payments_this_month
  FROM payments
  WHERE DATE_TRUNC('month', payment_date::TIMESTAMPTZ AT TIME ZONE 'America/Lima')
        = DATE_TRUNC('month', v_today::TIMESTAMP);

  -- Construir resultado
  v_result := jsonb_build_object(
    'totalActiveClients',       v_total_active,
    'totalDeactivatedClients',  v_total_deactivated,
    'clientsWithDebt',          v_clients_with_debt,
    'clientsWithOverdueDebt',   v_clients_overdue_debt,
    'inactiveClients',          v_inactive_clients,
    'birthdaysThisMonth',       v_birthdays_this_month,
    'pendingCollectionActions', v_pending_actions,
    'totalOutstandingDebt',     v_total_outstanding_debt,
    'totalOverdueDebt',         v_total_overdue_debt,
    'salesToday',               v_sales_today,
    'salesCountToday',          v_sales_count_today,
    'salesThisMonth',           v_sales_this_month,
    'lowStockProducts',         v_low_stock_products,
    'paymentsThisMonth',        v_payments_this_month
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics(INTEGER) TO authenticated;

COMMENT ON FUNCTION get_dashboard_metrics IS
  'KPIs del dashboard. Todas las fechas se calculan en zona America/Lima (UTC-5) para evitar el desfase entre la hora del servidor (UTC) y la hora del negocio.';
