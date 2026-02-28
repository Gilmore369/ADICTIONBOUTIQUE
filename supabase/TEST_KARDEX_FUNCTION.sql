-- ============================================================================
-- Test Kardex Function
-- ============================================================================
-- Este script prueba la función analytics.report_kardex

-- Test 1: Llamar la función sin filtros (últimos 30 días)
SELECT 'Test 1: Sin filtros' as test_name;
SELECT analytics.report_kardex('{}');

-- Test 2: Llamar la función con filtro de fecha
SELECT 'Test 2: Con filtro de fecha' as test_name;
SELECT analytics.report_kardex(jsonb_build_object(
  'start_date', (NOW() - INTERVAL '7 days')::text,
  'end_date', NOW()::text
));

-- Test 3: Verificar que los movimientos están ordenados por fecha ascendente
SELECT 'Test 3: Verificar orden cronológico' as test_name;
WITH kardex_result AS (
  SELECT analytics.report_kardex('{}') as result
),
rows_data AS (
  SELECT jsonb_array_elements(result->'rows') as row_data
  FROM kardex_result
)
SELECT 
  row_data->>'date' as fecha,
  row_data->>'productName' as producto,
  row_data->>'type' as tipo,
  (row_data->>'runningBalance')::integer as balance
FROM rows_data
ORDER BY row_data->>'date' ASC
LIMIT 10;

-- Test 4: Verificar KPIs
SELECT 'Test 4: Verificar KPIs' as test_name;
WITH kardex_result AS (
  SELECT analytics.report_kardex('{}') as result
)
SELECT 
  jsonb_array_elements(result->'kpis')->>'label' as kpi_label,
  jsonb_array_elements(result->'kpis')->>'value' as kpi_value
FROM kardex_result;

-- Test 5: Verificar estructura de columnas
SELECT 'Test 5: Verificar estructura de columnas' as test_name;
WITH kardex_result AS (
  SELECT analytics.report_kardex('{}') as result
)
SELECT 
  jsonb_array_elements(result->'meta'->'columns')->>'key' as column_key,
  jsonb_array_elements(result->'meta'->'columns')->>'label' as column_label,
  jsonb_array_elements(result->'meta'->'columns')->>'type' as column_type
FROM kardex_result;
