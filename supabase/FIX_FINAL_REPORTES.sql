-- ============================================================================
-- FIX FINAL: Ejecutar EJECUTAR_ANALYTICS.sql + Wrappers
-- ============================================================================
-- INSTRUCCIONES:
-- 1. Abre Supabase Dashboard > SQL Editor
-- 2. Ejecuta primero: supabase/EJECUTAR_ANALYTICS.sql (completo)
-- 3. Luego ejecuta este archivo
-- ============================================================================

-- Crear wrappers para todas las funciones de analytics
CREATE OR REPLACE FUNCTION public.report_inventory_rotation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_inventory_rotation(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_inventory_valuation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_inventory_valuation(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_low_stock(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_low_stock(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_timeline(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_timeline(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_by_month(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_by_month(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_by_product(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_by_product(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_by_category(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_by_category(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_credit_vs_cash(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_credit_vs_cash(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_summary(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_summary(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_sales_by_store(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_sales_by_store(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_kardex(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_kardex(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_purchases_by_supplier(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_purchases_by_supplier(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_purchases_by_period(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_purchases_by_period(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_clients_debt(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_clients_debt(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_overdue_installments(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_overdue_installments(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_collection_effectiveness(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_collection_effectiveness(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_profit_margin(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_profit_margin(filters); END; $$;

CREATE OR REPLACE FUNCTION public.report_cash_flow(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN analytics.report_cash_flow(filters); END; $$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.report_inventory_rotation TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_inventory_valuation TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_low_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_by_month TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_by_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_credit_vs_cash TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_sales_by_store TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_kardex TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_purchases_by_supplier TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_purchases_by_period TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_clients_debt TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_overdue_installments TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_collection_effectiveness TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_profit_margin TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_cash_flow TO authenticated;
