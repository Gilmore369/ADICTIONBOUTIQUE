# Implementation Plan: Analytics Reports Module

## Overview

Este plan implementa un sistema completo de Business Intelligence para un sistema retail multi-tienda con Next.js, TypeScript y Supabase/Postgres. El módulo proporciona 15+ reportes empresariales organizados en 5 categorías (Inventario, Ventas, Compras, Clientes, Financiero) con capacidades de visualización, filtrado y exportación.

La implementación sigue una arquitectura de 4 capas: SQL Analytics Layer (funciones RPC en Postgres), API Layer (route handlers Next.js), UI Layer (componentes React), y Export Layer (CSV/Excel/PDF). Se priorizan los cálculos en SQL para máximo rendimiento, con uso obligatorio de NULLIF/COALESCE para prevenir valores N/A.

## Tasks

- [x] 1. Crear SQL Analytics Layer - Schema y funciones base
  - Crear schema `analytics` en Postgres
  - Crear tabla `analytics.report_executions` para logging
  - Crear índices de performance en tablas existentes (sales, stock, movements, etc.)
  - Implementar función template base con estructura Report_Output
  - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 13.1, 13.2, 24.2_

- [x] 1.1 Write property test for Report Output structure
  - **Property 1: Report Output Structure Completeness**
  - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

- [ ] 2. Implementar funciones RPC de Inventario
  - [ ] 2.1 Implementar `analytics.report_inventory_rotation`
    - Calcular rotación como total_sold_qty / stock_final usando NULLIF
    - Calcular days_inventory como 365 / rotation usando NULLIF
    - Incluir KPIs: Productos Analizados, Total Vendido, Rotación Promedio
    - Generar series para gráfico de barras (top 20 productos)
    - Retornar rows con: barcode, name, totalSold, currentStock, rotation, daysInventory
    - _Requirements: 2.1, 2.2, 1.4, 1.5_

  - [x] 2.2 Write property tests for inventory rotation calculations
    - **Property 3: Division by Zero Prevention**
    - **Property 4: Inventory Rotation Calculation**
    - **Validates: Requirements 2.1, 2.2, 1.4**

  - [ ] 2.3 Implementar `analytics.report_inventory_valuation`
    - Calcular cost_value como stock_qty * cost_price
    - Calcular sale_value como stock_qty * sale_price
    - Calcular potential_margin como sale_value - cost_value
    - Incluir KPIs: Valor Costo Total, Valor Venta Total, Margen Potencial
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 2.4 Write property test for valorization calculations
    - **Property 5: Inventory Valorization Calculations**
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [ ] 2.5 Implementar `analytics.report_low_stock`
    - Filtrar productos donde stock_qty < min_stock (parámetro del filtro)
    - Incluir productos con stock = 0 (agotados)
    - Ordenar por stock ascendente
    - _Requirements: 2.6_

  - [x] 2.6 Write property test for low stock filtering
    - **Property 6: Low Stock Filtering Correctness**
    - **Validates: Requirements 2.6**

  - [ ] 2.7 Implementar `analytics.report_kardex`
    - Listar todos los movimientos con running balance
    - Ordenar por created_at ascendente
    - Incluir tipo de movimiento, cantidad, balance acumulado
    - _Requirements: 2.7, 2.8_

  - [x] 2.8 Write property test for kardex ordering
    - **Property 7: Kardex Chronological Ordering**
    - **Validates: Requirements 2.8**

- [x] 3. Checkpoint - Verificar funciones de inventario
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implementar funciones RPC de Ventas
  - [ ] 4.1 Implementar `analytics.report_sales_timeline`
    - Agrupar ventas por día
    - Calcular total_revenue, total_cost, gross_margin, margin_pct
    - Usar NULLIF para evitar división por cero en margin_pct
    - Generar series temporal para gráfico de líneas
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Write property tests for sales calculations
    - **Property 8: Margin Calculation Consistency**
    - **Property 9: Average Ticket Calculation**
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [ ] 4.3 Implementar `analytics.report_sales_by_month`
    - Agrupar ventas por mes usando DATE_TRUNC
    - Calcular KPIs mensuales: revenue, cost, margin, avg_ticket
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 4.4 Implementar `analytics.report_sales_by_product`
    - JOIN sale_items con products
    - Agrupar por product_id
    - Calcular cantidad vendida, revenue, cost, margin por producto
    - _Requirements: 3.8, 3.1, 3.2, 3.3_

  - [ ] 4.5 Implementar `analytics.report_sales_by_category`
    - JOIN products con categories
    - Agrupar por category_id
    - Calcular métricas por categoría
    - _Requirements: 3.9, 3.1, 3.2, 3.3_

  - [x] 4.6 Write property test for grouping uniqueness
    - **Property 10: Grouping Uniqueness**
    - **Validates: Requirements 3.6, 3.7**

  - [ ] 4.7 Implementar `analytics.report_credit_vs_cash`
    - Agrupar por sale_type (CONTADO vs CREDITO)
    - Comparar volumen y revenue por tipo de pago
    - Generar gráfico de pie chart
    - _Requirements: 3.6_

  - [ ] 4.8 Implementar `analytics.report_sales_summary`
    - Resumen general con KPIs principales
    - Total ventas, ticket promedio, productos más vendidos
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 4.9 Implementar `analytics.report_sales_by_store`
    - Agrupar por store_id
    - Comparar performance entre tiendas
    - _Requirements: 3.7, 18.1, 18.2_

- [x] 5. Checkpoint - Verificar funciones de ventas
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implementar funciones RPC de Compras, Clientes y Financiero
  - [ ] 6.1 Implementar `analytics.report_purchases_by_supplier`
    - Filtrar movements donde type = 'ENTRADA'
    - Agrupar por supplier_id
    - Calcular total_quantity y total_cost
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Write property tests for purchase calculations
    - **Property 11: Purchase Movement Type Filtering**
    - **Property 12: Purchase Cost Calculation**
    - **Validates: Requirements 4.1, 4.3**

  - [ ] 6.3 Implementar `analytics.report_purchases_by_period`
    - Agrupar compras por período de tiempo
    - Calcular tendencias de compra
    - _Requirements: 4.5_

  - [ ] 6.4 Implementar `analytics.report_clients_debt`
    - Calcular debt_balance como sum(installments.amount) - sum(paid_amount)
    - Filtrar clientes donde debt_balance > 0
    - Calcular utilización de crédito (credit_used / credit_limit)
    - _Requirements: 5.1, 5.2_

  - [x] 6.5 Write property tests for debt calculations
    - **Property 13: Client Debt Calculation**
    - **Validates: Requirements 5.1, 5.2**

  - [ ] 6.6 Implementar `analytics.report_overdue_installments`
    - Filtrar installments donde due_date < current_date AND status != 'PAID'
    - Calcular días de atraso
    - Ordenar por días de atraso descendente
    - _Requirements: 5.3_

  - [x] 6.7 Write property test for overdue filtering
    - **Property 14: Overdue Installments Filtering**
    - **Validates: Requirements 5.3**

  - [ ] 6.8 Implementar `analytics.report_collection_effectiveness`
    - Calcular collected_amount desde payments
    - Calcular expected_amount desde installments
    - Calcular effectiveness_pct usando NULLIF
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 6.9 Write property test for collection effectiveness
    - **Property 15: Collection Effectiveness Calculation**
    - **Validates: Requirements 5.4, 5.5, 5.6**

  - [ ] 6.10 Implementar `analytics.report_profit_margin`
    - Calcular revenue desde sales
    - Calcular cost desde sale_items JOIN products
    - Calcular gross_profit y margin_pct usando NULLIF
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.11 Implementar `analytics.report_cash_flow`
    - Calcular income desde sales (CONTADO) + payments (CREDITO)
    - Calcular expenses desde cash_expenses
    - Calcular net_cash_flow como income - expenses
    - Generar series temporal diaria
    - _Requirements: 6.5, 6.6, 6.7_

  - [x] 6.12 Write property test for cash flow calculations
    - **Property 16: Cash Flow Net Calculation**
    - **Validates: Requirements 6.5, 6.6, 6.7**

- [x] 7. Checkpoint - Verificar todas las funciones RPC
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Crear API Layer - Route handlers
  - [x] 8.1 Crear `/app/api/reports/[reportId]/route.ts`
    - Implementar POST handler con autenticación Supabase
    - Validar reportId contra lista de reportes válidos
    - Validar filtros con Zod schema
    - Validar rango de fechas (start_date < end_date)
    - Convertir reportId a nombre de función RPC
    - Llamar función RPC con filtros en formato JSONB
    - Manejar errores y retornar códigos HTTP apropiados
    - Registrar ejecución en analytics.report_executions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 22.1, 22.2, 22.3, 24.1, 24.2, 24.3, 24.4, 24.5_

  - [x] 8.2 Write unit tests for API validation
    - Test invalid reportId returns 400
    - Test invalid date range returns 400
    - Test unauthenticated request returns 401
    - Test successful request returns 200
    - _Requirements: 7.6, 14.1, 14.2, 22.2_

  - [x] 8.3 Crear `/lib/reports/report-types.ts`
    - Definir interfaces TypeScript: Report_Output, KPI, Series, Point, Row, Meta, Column
    - Definir ReportFilters interface
    - Definir ReportConfig interface
    - Definir ReportTypeId type union
    - Exportar constante REPORT_CONFIGS con configuración de cada reporte
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 17.1, 17.7_

  - [x] 8.4 Write property tests for type safety
    - **Property 2: No NULL Values in Numeric Fields**
    - **Property 17: ISO 8601 Date Format**
    - **Validates: Requirements 1.5, 20.1, 12.8**

- [ ] 9. Crear UI Layer - Componentes React
  - [x] 9.1 Crear `components/reports/ReportSelector.tsx`
    - Implementar selector de reportes con categorías
    - Organizar reportes en 5 categorías: Inventario, Ventas, Compras, Clientes, Financiero
    - Usar Select component de shadcn/ui con SelectGroup
    - Mostrar descripción del reporte seleccionado
    - _Requirements: 8.1, 8.2, 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8_

  - [x] 9.2 Crear `components/reports/FilterPanel.tsx`
    - Implementar panel de filtros dinámicos según reporte seleccionado
    - Incluir date pickers para startDate y endDate
    - Incluir botones de presets: Hoy, Esta Semana, Este Mes, Este Año
    - Incluir selects para store, warehouse, category, product, brand, supplier
    - Implementar botón "Limpiar Filtros"
    - Guardar filtros en sessionStorage para persistencia
    - _Requirements: 8.3, 8.4, 15.1, 15.2, 15.3, 15.4, 15.5, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [x] 9.3 Crear `components/reports/DateRangePresets.tsx`
    - Implementar botones de rangos predefinidos
    - Calcular fechas correctamente para cada preset
    - Resaltar preset activo
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 9.4 Crear `components/reports/KPICards.tsx`
    - Renderizar tarjetas de KPIs en grid responsive
    - Formatear valores según tipo (currency, percent, number, decimal)
    - Usar iconos apropiados para cada tipo de KPI
    - _Requirements: 8.5, 20.4, 20.5, 20.6, 20.7, 20.8_

  - [x] 9.5 Crear `components/reports/ChartRenderer.tsx`
    - Implementar renderizado de gráficos con Recharts
    - Soportar tipos: line, bar, pie
    - Configurar tooltips con formato de moneda
    - Configurar ejes con formato de números
    - Hacer gráficos responsive (ResponsiveContainer)
    - Aplicar paleta de colores del sistema
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 9.6 Write unit tests for chart rendering
    - Test line chart renders with time series data
    - Test bar chart renders with categorical data
    - Test pie chart renders with proportional data
    - Test tooltip formatting
    - _Requirements: 9.1, 9.2, 9.3, 9.7_

  - [x] 9.7 Crear `components/reports/DataTable.tsx`
    - Implementar tabla de datos con paginación
    - Formatear columnas según meta.columns type
    - Implementar ordenamiento por columna
    - Hacer tabla responsive con scroll horizontal en móvil
    - _Requirements: 8.8, 16.3, 20.4, 20.5, 20.6, 20.7, 20.8_

  - [x] 9.8 Crear `components/reports/ReportViewer.tsx`
    - Implementar contenedor principal con tabs "Gráficos" y "Datos"
    - Mostrar loading state mientras se carga el reporte
    - Mostrar error state si falla la carga
    - Integrar KPICards, ChartRenderer y DataTable
    - _Requirements: 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

  - [x] 9.9 Crear `components/reports/InsightsPanel.tsx`
    - Implementar panel de insights automáticos
    - Categorizar insights por severidad (info, warning, error, success)
    - Usar iconos y colores apropiados por tipo
    - _Requirements: 11.7, 11.8_

  - [x] 9.10 Write unit tests for responsive design
    - Test components render correctly at 320px width
    - Test components render correctly at 768px width
    - Test components render correctly at 1920px width
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 10. Checkpoint - Verificar componentes UI
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Crear Export Layer
  - [x] 11.1 Crear `lib/reports/export-utils.ts`
    - Implementar función `exportToCSV` con BOM para Excel UTF-8
    - Implementar función `exportToExcel` con formato usando xlsx
    - Implementar función `exportToPDF` con formato profesional usando jspdf
    - Implementar función `formatValue` para formatear según tipo
    - Implementar función principal `exportReport` que delega según formato
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 11.2 Crear `components/reports/ExportButtons.tsx`
    - Implementar botones de exportación para CSV, Excel, PDF
    - Mostrar loading state durante exportación
    - Transformar Report_Output a formato tabular para exportación
    - Incluir KPIs en archivo exportado
    - Incluir filtros aplicados en metadata
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 11.3 Write unit tests for export functionality
    - Test CSV export generates valid CSV with BOM
    - Test Excel export generates valid XLSX file
    - Test PDF export generates valid PDF file
    - Test exported files include KPIs and metadata
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 12. Implementar Insights Engine
  - [x] 12.1 Crear `lib/reports/insights.ts`
    - Implementar función `generateInsights` que delega según reportId
    - Implementar `generateRotationInsights` (slow moving, excess inventory, fast moving)
    - Implementar `generateLowStockInsights` (out of stock, low stock)
    - Implementar `generateMarginInsights` (low margin, negative margin, high margin)
    - Implementar `generateDebtInsights` (high utilization, overdue)
    - Implementar `generateCashFlowInsights` (negative flow, positive flow)
    - Implementar `generateOverdueInsights` (critical overdue, high amount)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 12.2 Write unit tests for insights generation
    - Test rotation insights detect slow moving products
    - Test low stock insights detect out of stock
    - Test margin insights detect negative margins
    - Test debt insights detect high utilization
    - Test cash flow insights detect negative flow
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 13. Crear página principal de reportes
  - [x] 13.1 Crear `/app/reports/page.tsx`
    - Integrar ReportSelector, FilterPanel, ReportViewer
    - Implementar lógica de carga de reportes
    - Manejar estados: idle, loading, success, error
    - Implementar debouncing de 500ms para cambios de filtros
    - Integrar InsightsPanel
    - Integrar ExportButtons
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 13.7_

  - [x] 13.2 Crear `/actions/reports.ts`
    - Implementar server action `generateReport`
    - Llamar API route `/api/reports/[reportId]`
    - Manejar errores y retornar formato consistente
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 14. Implementar internacionalización
  - [x] 14.1 Configurar formato español en toda la UI
    - Usar formato de fecha DD/MM/YYYY
    - Usar coma como separador decimal
    - Usar punto como separador de miles
    - Usar nombres de meses y días en español
    - Traducir todas las etiquetas y mensajes a español
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7_

  - [x] 14.2 Write property test for numeric formatting
    - **Property 18: Numeric Formatting Consistency**
    - **Validates: Requirements 20.4, 20.5, 20.6, 20.7, 20.8**

- [ ] 15. Implementar filtros avanzados y validación
  - [x] 15.1 Agregar validación de filtros en FilterPanel
    - Validar que startDate <= endDate
    - Mostrar mensajes de error inline
    - Deshabilitar botón "Generar" si hay errores
    - _Requirements: 14.1, 14.2, 14.7_

  - [x] 15.2 Implementar filtros de store y warehouse dinámicos
    - Cargar stores desde tabla stores
    - Cargar warehouses desde tabla warehouses
    - Aplicar RLS para mostrar solo stores/warehouses del usuario
    - _Requirements: 18.6, 18.7, 18.8, 22.5, 22.6_

  - [x] 15.3 Write property tests for filter application
    - **Property 19: Filter Application Correctness**
    - **Property 20: Store and Warehouse Filtering**
    - **Validates: Requirements 1.6, 7.3, 18.3, 18.4, 18.5**

- [ ] 16. Implementar manejo de errores completo
  - [x] 16.1 Crear `components/reports/ErrorDisplay.tsx`
    - Mostrar errores con formato consistente
    - Incluir botón "Reintentar"
    - Categorizar errores por tipo (validation, auth, server)
    - _Requirements: 14.8, 8.10_

  - [x] 16.2 Implementar timeout handling en API
    - Configurar timeout de 30 segundos para queries
    - Retornar error específico si timeout
    - Sugerir reducir rango de fechas o agregar filtros
    - _Requirements: 13.4_

  - [x] 16.3 Write unit tests for error handling
    - Test validation errors return 400
    - Test auth errors return 401
    - Test database errors return 500
    - Test timeout errors return appropriate message
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 17. Optimización y performance
  - [x] 17.1 Implementar caching en API Layer
    - Configurar Cache-Control headers (5 minutos)
    - Implementar cache de respuestas idénticas
    - _Requirements: 13.5, 13.6_

  - [x] 17.2 Crear vista materializada para ventas diarias (opcional)
    - Crear `analytics.mv_daily_sales`
    - Crear función de refresh automático
    - Configurar índice único
    - _Requirements: 13.3, 13.4_

  - [x] 17.3 Write performance tests
    - Test report generation completes within 5 seconds for 90 days
    - Test report generation completes within 10 seconds for 1 year
    - Test UI renders within 2 seconds after data received
    - _Requirements: 13.1, 13.2, 13.3_

- [ ] 18. Testing final y documentación
  - [x] 18.1 Write integration tests
    - Test complete flow: select report → apply filters → view results → export
    - Test filter persistence across report changes
    - Test insights generation for each report type
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 15.1, 15.2, 11.1_

  - [x] 18.2 Crear migration SQL completa
    - Consolidar todas las funciones RPC en un archivo de migración
    - Incluir schema, tablas, índices, funciones
    - Agregar comentarios explicativos
    - _Requirements: 1.1, 1.2, 1.7, 23.1-23.12_

  - [x] 18.3 Actualizar documentación de API
    - Documentar cada endpoint con ejemplos
    - Documentar estructura de filtros
    - Documentar estructura de respuestas
    - Documentar códigos de error
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 19. Checkpoint final - Verificación completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos que implementa para trazabilidad
- Los checkpoints aseguran validación incremental del progreso
- Los property tests validan propiedades universales de corrección con 100+ iteraciones
- Los unit tests validan ejemplos específicos y casos edge
- La implementación prioriza SQL para cálculos pesados, maximizando performance
- Uso obligatorio de NULLIF/COALESCE en todas las divisiones para prevenir valores N/A
- TypeScript end-to-end garantiza type safety desde SQL hasta UI
- Formato español (DD/MM/YYYY, coma decimal) en toda la interfaz
- Arquitectura de 4 capas claramente separadas: SQL → API → UI → Export
