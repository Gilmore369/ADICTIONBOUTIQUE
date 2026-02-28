-- ============================================================================
-- FIX: Agregar wrappers faltantes para funciones de analytics
-- ============================================================================
-- Este script agrega las funciones wrapper en el schema public que faltaban
-- para que las funciones de analytics puedan ser llamadas via RPC

-- 1. Inventory Rotation
CREATE OR REPLACE FUNCTION public.report_inventory_rotation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_inventory_rotation(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_inventory_rotation TO authenticated;

-- 2. Inventory Valuation
CREATE OR REPLACE FUNCTION public.report_inventory_valuation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_inventory_valuation(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_inventory_valuation TO authenticated;

-- 3. Low Stock
CREATE OR REPLACE FUNCTION public.report_low_stock(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_low_stock(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_low_stock TO authenticated;

-- 4. Sales Timeline
CREATE OR REPLACE FUNCTION public.report_sales_timeline(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_timeline(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_timeline TO authenticated;

-- 5. Sales by Month
CREATE OR REPLACE FUNCTION public.report_sales_by_month(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_by_month(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_month TO authenticated;

-- 6. Sales by Product
CREATE OR REPLACE FUNCTION public.report_sales_by_product(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_by_product(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_product TO authenticated;

-- 7. Sales by Category
CREATE OR REPLACE FUNCTION public.report_sales_by_category(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_by_category(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_category TO authenticated;

-- 8. Credit vs Cash
CREATE OR REPLACE FUNCTION public.report_credit_vs_cash(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_credit_vs_cash(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_credit_vs_cash TO authenticated;

-- 9. Sales Summary
CREATE OR REPLACE FUNCTION public.report_sales_summary(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_summary(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_summary TO authenticated;

-- 10. Sales by Store
CREATE OR REPLACE FUNCTION public.report_sales_by_store(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_sales_by_store(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_sales_by_store TO authenticated;

-- 11. Kardex
CREATE OR REPLACE FUNCTION public.report_kardex(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_kardex(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_kardex TO authenticated;

-- 12. Purchases by Supplier
CREATE OR REPLACE FUNCTION public.report_purchases_by_supplier(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_purchases_by_supplier(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_purchases_by_supplier TO authenticated;

-- 13. Purchases by Period
CREATE OR REPLACE FUNCTION public.report_purchases_by_period(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_purchases_by_period(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_purchases_by_period TO authenticated;

-- 14. Clients Debt
CREATE OR REPLACE FUNCTION public.report_clients_debt(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_clients_debt(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_clients_debt TO authenticated;

-- 15. Overdue Installments
CREATE OR REPLACE FUNCTION public.report_overdue_installments(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_overdue_installments(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_overdue_installments TO authenticated;

-- 16. Collection Effectiveness
CREATE OR REPLACE FUNCTION public.report_collection_effectiveness(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_collection_effectiveness(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_collection_effectiveness TO authenticated;

-- 17. Profit Margin
CREATE OR REPLACE FUNCTION public.report_profit_margin(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_profit_margin(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_profit_margin TO authenticated;

-- 18. Cash Flow
CREATE OR REPLACE FUNCTION public.report_cash_flow(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.report_cash_flow(filters);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_cash_flow TO authenticated;
