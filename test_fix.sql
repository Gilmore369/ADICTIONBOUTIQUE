-- ============================================================================
-- Analytics Reports Schema
-- ============================================================================
-- Crea un schema analytics con funciones RPC para reportes estructurados

CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- 1. REPORTE: Rotación de Inventario
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_inventory_rotation(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
  store_filter text;
  warehouse_filter text;
BEGIN
