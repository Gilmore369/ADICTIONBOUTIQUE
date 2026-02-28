# Bugfix Requirements Document

## Introduction

El módulo de reportes analíticos del sistema presenta múltiples defectos que impiden su funcionamiento correcto. El sistema actual tiene funciones RPC SQL incompletas que no coinciden con las opciones disponibles en el menú del frontend, cálculos matemáticos incorrectos que devuelven "N/A" en lugar de valores numéricos controlados, y estructuras de respuesta inconsistentes que dificultan el renderizado en el frontend.

Este bugfix corrige sistemáticamente todas las funciones RPC faltantes, repara los cálculos incorrectos usando NULLIF() y COALESCE(), y estandariza la estructura de respuesta para todos los reportes.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el usuario selecciona un reporte del menú (low-stock, kardex, sales-by-month, purchases-by-supplier, etc.) THEN el sistema falla con error "function does not exist" porque las funciones RPC no están implementadas en SQL

1.2 WHEN una función RPC realiza divisiones matemáticas (rotación, margen, porcentajes) THEN el sistema devuelve "N/A" o causa errores de división por cero porque no usa NULLIF() en los denominadores

1.3 WHEN una función RPC encuentra valores null en cálculos THEN el sistema devuelve null o "N/A" en lugar de 0 porque no usa COALESCE() para manejar valores nulos

1.4 WHEN el reporte "inventory-rotation" calcula la rotación THEN el sistema no incluye el campo "days_inventory" (días de inventario) en los resultados, mostrando datos incompletos

1.5 WHEN el reporte "inventory-valuation" agrupa por categoría THEN el sistema no agrupa correctamente los datos por categoría en la sección de series, mostrando datos desorganizados

1.6 WHEN el reporte "sales-by-month" se ejecuta THEN el sistema agrupa por día en lugar de por mes, mostrando granularidad incorrecta

1.7 WHEN los reportes de compras se ejecutan THEN el sistema falla porque no existen las funciones report_purchases_by_supplier y report_purchases_by_period, y deben usar la tabla movements con type='ENTRADA' como proxy

1.8 WHEN el frontend recibe respuestas de funciones RPC THEN el sistema encuentra estructuras inconsistentes porque algunas funciones no devuelven el formato estándar {kpis, series, rows, meta}

1.9 WHEN el reporte "overdue-installments" se ejecuta THEN el sistema falla porque la función report_overdue_installments no existe

1.10 WHEN el reporte "collection-effectiveness" se ejecuta THEN el sistema falla porque la función report_collection_effectiveness no existe

1.11 WHEN el reporte "sales-by-store" se ejecuta THEN el sistema falla porque la función report_sales_by_store no existe

1.12 WHEN el reporte "sales-summary" se ejecuta THEN el sistema falla porque la función report_sales_summary no existe

1.13 WHEN el reporte "credit-vs-cash" se ejecuta THEN el sistema falla porque la función report_credit_vs_cash no existe

### Expected Behavior (Correct)

2.1 WHEN el usuario selecciona cualquier reporte del menú THEN el sistema SHALL ejecutar la función RPC correspondiente exitosamente, devolviendo datos en formato {kpis, series, rows, meta}

2.2 WHEN una función RPC realiza divisiones matemáticas THEN el sistema SHALL usar NULLIF() en todos los denominadores para prevenir división por cero, devolviendo 0 en lugar de error

2.3 WHEN una función RPC encuentra valores null en cálculos THEN el sistema SHALL usar COALESCE() para convertir null a 0, asegurando que todos los cálculos numéricos devuelvan valores válidos

2.4 WHEN el reporte "inventory-rotation" calcula la rotación THEN el sistema SHALL incluir el campo "days_inventory" calculado como (periodo_dias * stock_actual / NULLIF(total_vendido, 0)) en los resultados

2.5 WHEN el reporte "inventory-valuation" agrupa por categoría THEN el sistema SHALL agrupar correctamente los datos por categoría en la sección series usando SUM() y GROUP BY

2.6 WHEN el reporte "sales-by-month" se ejecuta THEN el sistema SHALL agrupar por mes usando DATE_TRUNC('month', created_at) y TO_CHAR(created_at, 'YYYY-MM')

2.7 WHEN los reportes de compras se ejecutan THEN el sistema SHALL usar la tabla movements con filtro type='ENTRADA' para obtener datos de compras, calculando costos totales correctamente

2.8 WHEN el frontend recibe respuestas de funciones RPC THEN el sistema SHALL devolver siempre la estructura estándar {kpis: [], series: [], rows: [], meta: {columns: []}}

2.9 WHEN el reporte "overdue-installments" se ejecuta THEN el sistema SHALL crear y ejecutar la función report_overdue_installments que devuelve cuotas vencidas con días de atraso

2.10 WHEN el reporte "collection-effectiveness" se ejecuta THEN el sistema SHALL crear y ejecutar la función report_collection_effectiveness que calcula efectividad de cobranza como (pagos_recibidos / total_esperado * 100)

2.11 WHEN el reporte "sales-by-store" se ejecuta THEN el sistema SHALL crear y ejecutar la función report_sales_by_store que agrupa ventas por tienda

2.12 WHEN el reporte "sales-summary" se ejecuta THEN el sistema SHALL crear y ejecutar la función report_sales_summary que devuelve resumen de ventas con totales y promedios

2.13 WHEN el reporte "credit-vs-cash" se ejecuta THEN el sistema SHALL crear y ejecutar la función report_credit_vs_cash que compara ventas al contado vs crédito

### Unchanged Behavior (Regression Prevention)

3.1 WHEN las funciones RPC existentes (inventory-rotation, inventory-valuation, sales-timeline, sales-by-product, sales-by-category, profit-margin, clients-debt, cash-flow) se ejecutan THEN el sistema SHALL CONTINUE TO devolver datos correctos con la misma estructura de respuesta

3.2 WHEN el frontend llama a generateReport() con filtros válidos THEN el sistema SHALL CONTINUE TO aplicar los filtros correctamente (start_date, end_date, store_id, warehouse_id, category_id, etc.)

3.3 WHEN el usuario exporta reportes a CSV, Excel o PDF THEN el sistema SHALL CONTINUE TO exportar los datos correctamente usando las funciones de export-utils

3.4 WHEN las funciones RPC reciben filtros opcionales THEN el sistema SHALL CONTINUE TO manejar correctamente los casos donde los filtros son null o undefined

3.5 WHEN el sistema calcula KPIs en las funciones existentes THEN el sistema SHALL CONTINUE TO devolver los KPIs con el formato correcto {label, value, format}

3.6 WHEN el sistema genera series para gráficos THEN el sistema SHALL CONTINUE TO devolver arrays de puntos con formato {x, y} para renderizado correcto

3.7 WHEN el usuario cambia entre tabs de "Gráficos" y "Datos" THEN el sistema SHALL CONTINUE TO mostrar la información correctamente sin pérdida de datos

3.8 WHEN el sistema genera insights automáticos THEN el sistema SHALL CONTINUE TO analizar los datos y generar recomendaciones relevantes
