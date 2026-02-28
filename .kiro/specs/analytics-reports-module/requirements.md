# Requirements Document

## Introduction

Este documento especifica los requisitos para un módulo completo de reportes empresariales tipo SaaS/BI para un sistema de gestión retail multi-tienda construido con Next.js, TypeScript y Supabase/Postgres. El módulo proporcionará análisis de inventario, ventas, compras, clientes y finanzas con capacidades de visualización, filtrado y exportación.

## Glossary

- **Analytics_Module**: El sistema completo de reportes empresariales
- **Report_Engine**: El componente que ejecuta y genera reportes
- **SQL_Analytics_Layer**: Schema `analytics` en Postgres con funciones RPC
- **API_Layer**: Route handlers de Next.js en `/api/reports/:reportId`
- **UI_Layer**: Interfaz de usuario para visualización de reportes
- **Export_Engine**: Componente que genera archivos CSV, Excel y PDF
- **Filter_Set**: Conjunto de filtros aplicables (fecha, tienda, almacén, categoría, producto, marca, proveedor)
- **KPI**: Key Performance Indicator - métrica clave de negocio
- **Report_Output**: Estructura de datos con kpis, series, rows y meta
- **Rotation_Metric**: Métrica de rotación de inventario (total_sold_qty / stock_final)
- **Margin_Metric**: Métrica de margen (revenue - cost) / revenue
- **Cash_Flow**: Flujo de caja (ingresos - egresos)
- **Debt_Balance**: Saldo de deuda (installments.amount - paid_amount)

## Requirements

### Requirement 1: SQL Analytics Layer

**User Story:** Como desarrollador, quiero un schema analytics en Postgres con funciones RPC optimizadas, para que los cálculos de reportes se ejecuten en la base de datos con alto rendimiento.

#### Acceptance Criteria

1. THE SQL_Analytics_Layer SHALL create a schema named `analytics` in Postgres
2. THE SQL_Analytics_Layer SHALL implement RPC functions for each report type
3. WHEN an RPC function is called, THE SQL_Analytics_Layer SHALL return a Report_Output structure with kpis, series, rows and meta fields
4. THE SQL_Analytics_Layer SHALL use NULLIF and COALESCE to prevent division by zero
5. THE SQL_Analytics_Layer SHALL never return NULL values in numeric calculations
6. THE SQL_Analytics_Layer SHALL accept Filter_Set parameters (date_from, date_to, store_id, warehouse_id, category_id, product_id, brand_id, supplier_id)
7. THE SQL_Analytics_Layer SHALL apply appropriate indexes for query optimization
8. WHERE a report requires heavy computation, THE SQL_Analytics_Layer SHALL use materialized views


### Requirement 2: Inventory Reports

**User Story:** Como gerente de inventario, quiero reportes de rotación, valorización, stock bajo y kardex, para que pueda optimizar el inventario y prevenir quiebres de stock.

#### Acceptance Criteria

1. WHEN the rotation report is requested, THE Report_Engine SHALL calculate rotation as total_sold_qty divided by stock_final using NULLIF
2. WHEN the rotation report is requested, THE Report_Engine SHALL calculate days_inventory as 365 divided by rotation using NULLIF
3. WHEN the valorization report is requested, THE Report_Engine SHALL calculate cost_value as stock_qty multiplied by cost_price
4. WHEN the valorization report is requested, THE Report_Engine SHALL calculate sale_value as stock_qty multiplied by sale_price
5. WHEN the valorization report is requested, THE Report_Engine SHALL calculate potential_margin as sale_value minus cost_value
6. WHEN the low stock report is requested, THE Report_Engine SHALL identify products where stock_qty is less than min_stock
7. WHEN the kardex report is requested, THE Report_Engine SHALL list all movements with running balance calculation
8. THE Report_Engine SHALL order kardex movements by date ascending

### Requirement 3: Sales Reports

**User Story:** Como gerente de ventas, quiero reportes de ventas por período, mes, producto, categoría, tipo de pago y tienda, para que pueda analizar el desempeño comercial.

#### Acceptance Criteria

1. WHEN a sales report is requested, THE Report_Engine SHALL calculate total_revenue from sales table
2. WHEN a sales report is requested, THE Report_Engine SHALL calculate total_cost from sale_items joined with products
3. WHEN a sales report is requested, THE Report_Engine SHALL calculate gross_margin as total_revenue minus total_cost
4. WHEN a sales report is requested, THE Report_Engine SHALL calculate margin_pct as gross_margin divided by total_revenue using NULLIF
5. WHEN a sales report is requested, THE Report_Engine SHALL calculate avg_ticket as total_revenue divided by sale_count using NULLIF
6. WHEN sales by payment type is requested, THE Report_Engine SHALL group by payment_type field
7. WHEN sales by store is requested, THE Report_Engine SHALL group by store_id field
8. WHEN sales by product is requested, THE Report_Engine SHALL join sale_items with products table
9. WHEN sales by category is requested, THE Report_Engine SHALL join products with categories table

### Requirement 4: Purchase Reports

**User Story:** Como gerente de compras, quiero reportes de compras por proveedor y período, para que pueda evaluar proveedores y planificar adquisiciones.

#### Acceptance Criteria

1. WHEN a purchase report is requested, THE Report_Engine SHALL query movements table where type equals 'ENTRADA'
2. WHEN a purchase report is requested, THE Report_Engine SHALL calculate total_quantity from movements
3. WHEN a purchase report is requested, THE Report_Engine SHALL calculate total_cost as quantity multiplied by unit_cost
4. WHEN purchases by supplier is requested, THE Report_Engine SHALL group by supplier_id field
5. WHEN purchases by period is requested, THE Report_Engine SHALL group by date ranges


### Requirement 5: Client Reports

**User Story:** Como gerente de crédito, quiero reportes de clientes con deuda, cuotas vencidas y efectividad de cobranza, para que pueda gestionar la cartera de créditos.

#### Acceptance Criteria

1. WHEN a client debt report is requested, THE Report_Engine SHALL calculate debt_balance as installments.amount minus paid_amount
2. WHEN a client debt report is requested, THE Report_Engine SHALL filter clients where debt_balance is greater than zero
3. WHEN an overdue installments report is requested, THE Report_Engine SHALL filter installments where due_date is less than current_date and status is not 'PAID'
4. WHEN a collection effectiveness report is requested, THE Report_Engine SHALL calculate collected_amount from payments table
5. WHEN a collection effectiveness report is requested, THE Report_Engine SHALL calculate expected_amount from installments table
6. WHEN a collection effectiveness report is requested, THE Report_Engine SHALL calculate effectiveness_pct as collected_amount divided by expected_amount using NULLIF

### Requirement 6: Financial Reports

**User Story:** Como gerente financiero, quiero reportes de margen de ganancia y flujo de caja, para que pueda evaluar la salud financiera del negocio.

#### Acceptance Criteria

1. WHEN a profit margin report is requested, THE Report_Engine SHALL calculate revenue from sales table
2. WHEN a profit margin report is requested, THE Report_Engine SHALL calculate cost from sale_items joined with products
3. WHEN a profit margin report is requested, THE Report_Engine SHALL calculate gross_profit as revenue minus cost
4. WHEN a profit margin report is requested, THE Report_Engine SHALL calculate margin_pct as gross_profit divided by revenue using NULLIF
5. WHEN a cash flow report is requested, THE Report_Engine SHALL calculate income from sales and payments tables
6. WHEN a cash flow report is requested, THE Report_Engine SHALL calculate expenses from cash_expenses table
7. WHEN a cash flow report is requested, THE Report_Engine SHALL calculate net_cash_flow as income minus expenses

### Requirement 7: API Layer

**User Story:** Como desarrollador frontend, quiero endpoints REST para cada reporte, para que pueda consumir los datos desde la interfaz de usuario.

#### Acceptance Criteria

1. THE API_Layer SHALL create route handlers at `/api/reports/:reportId`
2. WHEN a report request is received, THE API_Layer SHALL validate the reportId parameter
3. WHEN a report request is received, THE API_Layer SHALL validate Filter_Set parameters
4. WHEN a report request is received, THE API_Layer SHALL call the corresponding SQL_Analytics_Layer RPC function
5. WHEN a report request is received, THE API_Layer SHALL return Report_Output in JSON format
6. IF an invalid reportId is provided, THEN THE API_Layer SHALL return HTTP 400 with error message
7. IF an RPC function fails, THEN THE API_Layer SHALL return HTTP 500 with error details
8. THE API_Layer SHALL set appropriate CORS headers for API responses


### Requirement 8: UI Layer - Report Visualization

**User Story:** Como usuario del sistema, quiero una interfaz visual para seleccionar reportes, aplicar filtros y ver resultados en gráficos y tablas, para que pueda analizar datos fácilmente.

#### Acceptance Criteria

1. THE UI_Layer SHALL display a report selector with all available report types
2. THE UI_Layer SHALL display Filter_Set controls (date range, store, warehouse, category, product, brand, supplier)
3. WHEN a user selects a report, THE UI_Layer SHALL enable relevant filters for that report type
4. WHEN a user applies filters, THE UI_Layer SHALL call the API_Layer with filter parameters
5. WHEN report data is received, THE UI_Layer SHALL display KPI cards at the top
6. THE UI_Layer SHALL display tabs for "Gráficos" and "Datos" views
7. WHEN the Gráficos tab is active, THE UI_Layer SHALL render charts using Recharts library
8. WHEN the Datos tab is active, THE UI_Layer SHALL render a data table with all rows
9. THE UI_Layer SHALL display loading state while fetching report data
10. IF an API error occurs, THEN THE UI_Layer SHALL display an error message to the user

### Requirement 9: Chart Visualization

**User Story:** Como usuario del sistema, quiero visualizar datos de reportes en gráficos interactivos, para que pueda identificar tendencias y patrones rápidamente.

#### Acceptance Criteria

1. WHEN series data contains time-based points, THE UI_Layer SHALL render a line chart
2. WHEN series data contains categorical comparisons, THE UI_Layer SHALL render a bar chart
3. WHEN series data represents proportions, THE UI_Layer SHALL render a pie chart
4. THE UI_Layer SHALL use Recharts library for all chart rendering
5. THE UI_Layer SHALL display chart tooltips on hover
6. THE UI_Layer SHALL format numeric values with appropriate decimal places
7. THE UI_Layer SHALL format currency values with currency symbol
8. THE UI_Layer SHALL format percentage values with percent symbol

### Requirement 10: Export Functionality

**User Story:** Como usuario del sistema, quiero exportar reportes a CSV, Excel y PDF, para que pueda compartir y analizar datos fuera del sistema.

#### Acceptance Criteria

1. THE Export_Engine SHALL provide export buttons for CSV, Excel and PDF formats
2. WHEN CSV export is requested, THE Export_Engine SHALL generate a CSV file with all report rows
3. WHEN Excel export is requested, THE Export_Engine SHALL generate an XLSX file using a spreadsheet library
4. WHEN PDF export is requested, THE Export_Engine SHALL generate a PDF file using jspdf library
5. THE Export_Engine SHALL include KPI summary in exported files
6. THE Export_Engine SHALL include filter parameters in exported file metadata
7. THE Export_Engine SHALL format column headers with human-readable labels from meta.columns
8. THE Export_Engine SHALL trigger browser download when export is complete


### Requirement 11: Automatic Insights

**User Story:** Como usuario del sistema, quiero recibir insights automáticos basados en reglas de negocio, para que pueda identificar oportunidades y problemas sin análisis manual.

#### Acceptance Criteria

1. WHEN a rotation report shows products with rotation less than 1, THE Analytics_Module SHALL generate an insight about slow-moving inventory
2. WHEN a rotation report shows products with days_inventory greater than 180, THE Analytics_Module SHALL generate an insight about excess inventory
3. WHEN a low stock report shows products below min_stock, THE Analytics_Module SHALL generate an insight about reorder needed
4. WHEN a sales report shows margin_pct less than 20 percent, THE Analytics_Module SHALL generate an insight about low profitability
5. WHEN a client debt report shows overdue installments greater than 30 days, THE Analytics_Module SHALL generate an insight about collection risk
6. WHEN a cash flow report shows negative net_cash_flow, THE Analytics_Module SHALL generate an insight about liquidity concern
7. THE Analytics_Module SHALL display insights in a dedicated section of the UI
8. THE Analytics_Module SHALL categorize insights by severity (info, warning, critical)

### Requirement 12: Report Output Structure

**User Story:** Como desarrollador, quiero una estructura de datos consistente para todos los reportes, para que pueda procesar resultados de manera uniforme.

#### Acceptance Criteria

1. THE Report_Engine SHALL return Report_Output with four fields: kpis, series, rows and meta
2. THE Report_Output.kpis field SHALL be an array of objects with label and value properties
3. THE Report_Output.series field SHALL be an array of objects with name and points properties
4. THE Report_Output.series.points field SHALL be an array of objects with x and y properties
5. THE Report_Output.rows field SHALL be an array of objects representing tabular data
6. THE Report_Output.meta field SHALL contain a columns array with key, label and type properties
7. THE Report_Output SHALL use consistent property names across all report types
8. THE Report_Output SHALL format dates as ISO 8601 strings

### Requirement 13: Performance Optimization

**User Story:** Como administrador del sistema, quiero que los reportes se generen rápidamente incluso con grandes volúmenes de datos, para que los usuarios tengan una experiencia fluida.

#### Acceptance Criteria

1. THE SQL_Analytics_Layer SHALL create indexes on frequently queried columns (date, store_id, product_id, category_id)
2. THE SQL_Analytics_Layer SHALL create composite indexes for common filter combinations
3. WHERE a report query takes longer than 5 seconds, THE SQL_Analytics_Layer SHALL use a materialized view
4. THE SQL_Analytics_Layer SHALL refresh materialized views on a scheduled basis
5. THE API_Layer SHALL implement response caching for identical requests within 5 minutes
6. THE API_Layer SHALL set appropriate cache-control headers
7. THE UI_Layer SHALL implement debouncing for filter changes with 500ms delay


### Requirement 14: Data Validation and Error Handling

**User Story:** Como usuario del sistema, quiero mensajes de error claros cuando algo falla, para que pueda corregir problemas o reportarlos adecuadamente.

#### Acceptance Criteria

1. WHEN invalid date ranges are provided, THE API_Layer SHALL return HTTP 400 with message "Invalid date range"
2. WHEN date_from is after date_to, THE API_Layer SHALL return HTTP 400 with message "Start date must be before end date"
3. WHEN a non-existent store_id is provided, THE API_Layer SHALL return HTTP 400 with message "Store not found"
4. WHEN a non-existent product_id is provided, THE API_Layer SHALL return HTTP 400 with message "Product not found"
5. IF a database connection fails, THEN THE API_Layer SHALL return HTTP 503 with message "Service temporarily unavailable"
6. IF an RPC function throws an error, THEN THE API_Layer SHALL log the error details and return HTTP 500
7. THE UI_Layer SHALL display validation errors inline with filter controls
8. THE UI_Layer SHALL display API errors in a toast notification

### Requirement 15: Filter Persistence

**User Story:** Como usuario del sistema, quiero que mis filtros seleccionados persistan al cambiar entre reportes, para que no tenga que reconfigurar filtros repetidamente.

#### Acceptance Criteria

1. WHEN a user applies filters, THE UI_Layer SHALL store filter values in browser session storage
2. WHEN a user navigates to a different report, THE UI_Layer SHALL restore applicable filters from session storage
3. WHEN a user closes the browser, THE UI_Layer SHALL clear filter values from session storage
4. THE UI_Layer SHALL provide a "Clear Filters" button to reset all filters
5. WHEN the Clear Filters button is clicked, THE UI_Layer SHALL remove filter values from session storage

### Requirement 16: Responsive Design

**User Story:** Como usuario móvil, quiero acceder a reportes desde mi dispositivo móvil, para que pueda consultar datos en cualquier momento.

#### Acceptance Criteria

1. THE UI_Layer SHALL render responsively on screen widths from 320px to 2560px
2. WHEN viewed on mobile devices, THE UI_Layer SHALL stack filter controls vertically
3. WHEN viewed on mobile devices, THE UI_Layer SHALL make data tables horizontally scrollable
4. WHEN viewed on mobile devices, THE UI_Layer SHALL adjust chart dimensions to fit screen width
5. THE UI_Layer SHALL use touch-friendly button sizes (minimum 44px height)


### Requirement 17: Report Configuration Parser

**User Story:** Como desarrollador, quiero un parser de configuración de reportes y un pretty printer, para que pueda definir reportes de manera declarativa y mantener configuraciones legibles.

#### Acceptance Criteria

1. WHEN a report configuration file is provided, THE Report_Engine SHALL parse it into a Report_Config object
2. WHEN an invalid configuration file is provided, THE Report_Engine SHALL return a descriptive error with line number
3. THE Report_Engine SHALL validate that all required fields are present in configuration
4. THE Report_Engine SHALL validate that filter types match allowed values
5. THE Report_Engine SHALL validate that metric formulas reference valid database columns
6. THE Pretty_Printer SHALL format Report_Config objects back into valid configuration files
7. FOR ALL valid Report_Config objects, parsing then printing then parsing SHALL produce an equivalent object
8. THE Report_Engine SHALL support configuration fields: id, name, category, filters, metrics, groupBy, orderBy

### Requirement 18: Multi-Store and Multi-Warehouse Support

**User Story:** Como gerente de múltiples tiendas, quiero filtrar reportes por tienda y almacén específicos, para que pueda comparar desempeño entre ubicaciones.

#### Acceptance Criteria

1. THE Report_Engine SHALL accept store_id as an optional filter parameter
2. THE Report_Engine SHALL accept warehouse_id as an optional filter parameter
3. WHEN no store_id is provided, THE Report_Engine SHALL aggregate data across all stores
4. WHEN no warehouse_id is provided, THE Report_Engine SHALL aggregate data across all warehouses
5. WHEN both store_id and warehouse_id are provided, THE Report_Engine SHALL filter by both criteria
6. THE UI_Layer SHALL populate store dropdown from stores table
7. THE UI_Layer SHALL populate warehouse dropdown from warehouses table
8. THE UI_Layer SHALL display "All Stores" and "All Warehouses" as default options

### Requirement 19: Date Range Presets

**User Story:** Como usuario del sistema, quiero seleccionar rangos de fecha predefinidos (hoy, esta semana, este mes, este año), para que pueda generar reportes comunes rápidamente.

#### Acceptance Criteria

1. THE UI_Layer SHALL provide preset buttons for "Hoy", "Esta Semana", "Este Mes", "Este Año"
2. WHEN "Hoy" is clicked, THE UI_Layer SHALL set date_from and date_to to current date
3. WHEN "Esta Semana" is clicked, THE UI_Layer SHALL set date range to current week (Monday to Sunday)
4. WHEN "Este Mes" is clicked, THE UI_Layer SHALL set date range to current month (first to last day)
5. WHEN "Este Año" is clicked, THE UI_Layer SHALL set date range to current year (January 1 to December 31)
6. THE UI_Layer SHALL also provide custom date picker for manual date selection
7. WHEN a preset is selected, THE UI_Layer SHALL highlight the active preset button


### Requirement 20: Numeric Formatting Standards

**User Story:** Como usuario del sistema, quiero que todos los números se muestren con formato consistente y sin valores N/A, para que los reportes sean profesionales y legibles.

#### Acceptance Criteria

1. THE Analytics_Module SHALL never display "N/A" or NULL in numeric fields
2. WHEN a division by zero would occur, THE SQL_Analytics_Layer SHALL use NULLIF in the denominator
3. WHEN a NULL result would occur, THE SQL_Analytics_Layer SHALL use COALESCE to provide a default value of 0
4. THE UI_Layer SHALL format currency values with 2 decimal places
5. THE UI_Layer SHALL format percentage values with 1 decimal place
6. THE UI_Layer SHALL format quantity values with 0 decimal places
7. THE UI_Layer SHALL format decimal metrics with 2 decimal places
8. THE UI_Layer SHALL use thousand separators for numbers greater than 999

### Requirement 21: Report Categories Organization

**User Story:** Como usuario del sistema, quiero que los reportes estén organizados por categorías, para que pueda encontrar el reporte que necesito rápidamente.

#### Acceptance Criteria

1. THE UI_Layer SHALL organize reports into five categories: Inventario, Ventas, Compras, Clientes, Financiero
2. THE UI_Layer SHALL display category tabs or sections in the report selector
3. WHEN a category is selected, THE UI_Layer SHALL display only reports in that category
4. THE Inventario category SHALL contain: Rotación de Stock, Valorización, Stock Bajo, Kardex
5. THE Ventas category SHALL contain: Por Período, Por Mes, Por Producto, Por Categoría, Crédito vs Contado, Resumen, Por Tienda
6. THE Compras category SHALL contain: Por Proveedor, Por Período
7. THE Clientes category SHALL contain: Con Deuda, Cuotas Vencidas, Efectividad de Cobranza
8. THE Financiero category SHALL contain: Margen de Ganancia, Flujo de Caja

### Requirement 22: Security and Access Control

**User Story:** Como administrador del sistema, quiero que solo usuarios autenticados puedan acceder a reportes, para que la información financiera esté protegida.

#### Acceptance Criteria

1. THE API_Layer SHALL verify user authentication before processing report requests
2. IF a user is not authenticated, THEN THE API_Layer SHALL return HTTP 401 with message "Authentication required"
3. THE API_Layer SHALL use Supabase auth to validate user sessions
4. THE API_Layer SHALL apply Row Level Security (RLS) policies on database queries
5. THE SQL_Analytics_Layer SHALL filter data based on user's assigned stores
6. WHERE a user has access to specific stores only, THE SQL_Analytics_Layer SHALL restrict report data to those stores
7. THE UI_Layer SHALL redirect unauthenticated users to login page


### Requirement 23: Database Schema Integration

**User Story:** Como desarrollador, quiero que el módulo de reportes se integre correctamente con el schema existente, para que pueda aprovechar los datos actuales sin duplicación.

#### Acceptance Criteria

1. THE SQL_Analytics_Layer SHALL query the existing products table for product data
2. THE SQL_Analytics_Layer SHALL query the existing stock table for inventory data
3. THE SQL_Analytics_Layer SHALL query the existing movements table for stock movements
4. THE SQL_Analytics_Layer SHALL query the existing sales table for sales transactions
5. THE SQL_Analytics_Layer SHALL query the existing sale_items table for line item details
6. THE SQL_Analytics_Layer SHALL query the existing clients table for client information
7. THE SQL_Analytics_Layer SHALL query the existing credit_plans table for credit data
8. THE SQL_Analytics_Layer SHALL query the existing installments table for payment schedules
9. THE SQL_Analytics_Layer SHALL query the existing payments table for payment records
10. THE SQL_Analytics_Layer SHALL query the existing cash_shifts table for cash register data
11. THE SQL_Analytics_Layer SHALL query the existing cash_expenses table for expense records
12. THE SQL_Analytics_Layer SHALL use appropriate JOIN operations to combine related tables

### Requirement 24: Report Execution Logging

**User Story:** Como administrador del sistema, quiero registrar la ejecución de reportes, para que pueda auditar el uso y diagnosticar problemas de rendimiento.

#### Acceptance Criteria

1. WHEN a report is executed, THE API_Layer SHALL log the report_id, user_id, filters and execution_time
2. THE API_Layer SHALL store execution logs in a report_executions table
3. THE API_Layer SHALL record timestamp of report execution
4. THE API_Layer SHALL record execution duration in milliseconds
5. IF a report execution fails, THEN THE API_Layer SHALL log the error message and stack trace
6. THE Analytics_Module SHALL provide an admin view to query execution logs
7. THE Analytics_Module SHALL calculate average execution time per report type

### Requirement 25: Internationalization Support

**User Story:** Como usuario del sistema, quiero que los reportes se muestren en español, para que sean accesibles para todos los usuarios de la empresa.

#### Acceptance Criteria

1. THE UI_Layer SHALL display all labels and messages in Spanish
2. THE UI_Layer SHALL format dates using Spanish locale (DD/MM/YYYY)
3. THE UI_Layer SHALL use Spanish month names in date displays
4. THE UI_Layer SHALL use Spanish day names in date displays
5. THE UI_Layer SHALL use comma as decimal separator and period as thousand separator
6. THE Report_Output.meta.columns SHALL include Spanish labels for all columns
7. THE Analytics_Module SHALL use Spanish terms for report categories and names

