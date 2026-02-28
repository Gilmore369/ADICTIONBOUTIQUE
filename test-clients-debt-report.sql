-- Test script for analytics.report_clients_debt function
-- This script can be run in the Supabase SQL Editor

-- First, verify the function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'analytics' 
AND routine_name = 'report_clients_debt';

-- Test the function with default filters (last 365 days)
SELECT analytics.report_clients_debt('{}');

-- Test with specific date range
SELECT analytics.report_clients_debt(jsonb_build_object(
  'start_date', '2024-01-01T00:00:00Z',
  'end_date', '2024-12-31T23:59:59Z'
));

-- Verify the structure of the result
WITH test_result AS (
  SELECT analytics.report_clients_debt('{}') as report
)
SELECT 
  jsonb_typeof(report) as report_type,
  jsonb_typeof(report->'kpis') as kpis_type,
  jsonb_typeof(report->'series') as series_type,
  jsonb_typeof(report->'rows') as rows_type,
  jsonb_typeof(report->'meta') as meta_type,
  jsonb_array_length(report->'kpis') as kpis_count,
  jsonb_array_length(report->'series') as series_count
FROM test_result;

-- Check KPI labels
WITH test_result AS (
  SELECT analytics.report_clients_debt('{}') as report
)
SELECT 
  jsonb_array_elements(report->'kpis')->>'label' as kpi_label,
  jsonb_array_elements(report->'kpis')->>'format' as kpi_format
FROM test_result;

-- Check that debt_balance calculation is correct
-- debt_balance should equal total_installments - total_paid
WITH test_result AS (
  SELECT analytics.report_clients_debt('{}') as report
)
SELECT 
  row_data->>'clientName' as client_name,
  (row_data->>'totalInstallments')::numeric as total_installments,
  (row_data->>'totalPaid')::numeric as total_paid,
  (row_data->>'debtBalance')::numeric as debt_balance,
  (row_data->>'totalInstallments')::numeric - (row_data->>'totalPaid')::numeric as calculated_debt,
  -- Verify they match
  CASE 
    WHEN (row_data->>'debtBalance')::numeric = (row_data->>'totalInstallments')::numeric - (row_data->>'totalPaid')::numeric 
    THEN 'PASS' 
    ELSE 'FAIL' 
  END as validation
FROM test_result,
LATERAL jsonb_array_elements(report->'rows') as row_data
LIMIT 10;

-- Check that all clients have debt_balance > 0
WITH test_result AS (
  SELECT analytics.report_clients_debt('{}') as report
)
SELECT 
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE (row_data->>'debtBalance')::numeric > 0) as clients_with_positive_debt,
  COUNT(*) FILTER (WHERE (row_data->>'debtBalance')::numeric <= 0) as clients_with_zero_or_negative_debt
FROM test_result,
LATERAL jsonb_array_elements(report->'rows') as row_data;

-- Check credit utilization calculation
-- credit_utilization_pct should equal (credit_used / credit_limit) * 100
WITH test_result AS (
  SELECT analytics.report_clients_debt('{}') as report
)
SELECT 
  row_data->>'clientName' as client_name,
  (row_data->>'creditLimit')::numeric as credit_limit,
  (row_data->>'creditUsed')::numeric as credit_used,
  (row_data->>'creditUtilizationPct')::numeric as credit_utilization_pct,
  CASE 
    WHEN (row_data->>'creditLimit')::numeric > 0 
    THEN ROUND((row_data->>'creditUsed')::numeric / (row_data->>'creditLimit')::numeric * 100, 2)
    ELSE 0
  END as calculated_utilization,
  -- Verify they match
  CASE 
    WHEN (row_data->>'creditUtilizationPct')::numeric = CASE 
      WHEN (row_data->>'creditLimit')::numeric > 0 
      THEN ROUND((row_data->>'creditUsed')::numeric / (row_data->>'creditLimit')::numeric * 100, 2)
      ELSE 0
    END
    THEN 'PASS' 
    ELSE 'FAIL' 
  END as validation
FROM test_result,
LATERAL jsonb_array_elements(report->'rows') as row_data
WHERE (row_data->>'creditLimit')::numeric > 0
LIMIT 10;

-- Check that no numeric fields are NULL
WITH test_result AS (
  SELECT analytics.report_clients_debt('{}') as report
)
SELECT 
  'creditLimit' as field,
  COUNT(*) FILTER (WHERE row_data->>'creditLimit' IS NULL OR row_data->>'creditLimit' = 'null') as null_count
FROM test_result,
LATERAL jsonb_array_elements(report->'rows') as row_data
UNION ALL
SELECT 
  'creditUsed' as field,
  COUNT(*) FILTER (WHERE row_data->>'creditUsed' IS NULL OR row_data->>'creditUsed' = 'null') as null_count
FROM test_result,
LATERAL jsonb_array_elements(report->'rows') as row_data
UNION ALL
SELECT 
  'debtBalance' as field,
  COUNT(*) FILTER (WHERE row_data->>'debtBalance' IS NULL OR row_data->>'debtBalance' = 'null') as null_count
FROM test_result,
LATERAL jsonb_array_elements(report->'rows') as row_data
UNION ALL
SELECT 
  'creditUtilizationPct' as field,
  COUNT(*) FILTER (WHERE row_data->>'creditUtilizationPct' IS NULL OR row_data->>'creditUtilizationPct' = 'null') as null_count
FROM test_result,
LATERAL jsonb_array_elements(report->'rows') as row_data;
