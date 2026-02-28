# Task 6.4: Implementar `analytics.report_clients_debt`

## Resumen

Se ha implementado la función SQL `analytics.report_clients_debt` que calcula la deuda de clientes basándose en cuotas pendientes y pagos realizados.

## Archivos Modificados

1. **supabase/migrations/20240302000000_analytics_reports.sql**
   - Se agregó la función `analytics.report_clients_debt` al final del archivo

2. **apply-clients-debt-function.sql** (nuevo)
   - Script standalone para aplicar solo esta función en Supabase SQL Editor

3. **test-clients-debt-report.sql** (nuevo)
   - Script de pruebas para validar la función

## Funcionalidad Implementada

### Cálculos Principales

1. **debt_balance**: `SUM(installments.amount) - SUM(paid_amount)`
   - Calcula el saldo de deuda como la diferencia entre cuotas totales y pagos realizados

2. **credit_utilization_pct**: `(credit_used / credit_limit) * 100`
   - Calcula el porcentaje de utilización del crédito disponible
   - Usa NULLIF para prevenir división por cero

3. **Filtrado**: Solo incluye clientes con `debt_balance > 0`

### KPIs Incluidos

1. Clientes con Deuda (número)
2. Deuda Total (moneda)
3. Deuda Promedio (moneda)
4. Total Pagado (moneda)
5. Clientes con Cuotas Vencidas (número)
6. Utilización de Crédito Total (porcentaje)

### Series de Gráficos

1. **Top 20 Clientes por Deuda**: Gráfico de barras mostrando los clientes con mayor deuda
2. **Utilización de Crédito por Cliente**: Gráfico mostrando el % de utilización de crédito

### Columnas en Tabla de Datos

- DNI
- Cliente
- Teléfono
- Límite de Crédito
- Crédito Usado
- Utilización %
- Total Cuotas
- Total Pagado
- Saldo Deuda
- Cuotas Pendientes
- Cuotas Vencidas
- Planes Activos
- Última Fecha Vencida
- Días de Atraso

## Cómo Aplicar la Función

### Opción 1: Supabase SQL Editor (Recomendado)

1. Ir a Supabase Dashboard → SQL Editor
2. Copiar el contenido de `apply-clients-debt-function.sql`
3. Ejecutar el script
4. Verificar que la función se creó correctamente

### Opción 2: Aplicar toda la migración

```bash
# Si tienes acceso local a Supabase
npx supabase db reset
```

## Cómo Probar la Función

### Prueba Básica

```sql
-- Ejecutar con filtros por defecto (últimos 365 días)
SELECT analytics.report_clients_debt('{}');
```

### Prueba con Filtros de Fecha

```sql
-- Ejecutar con rango de fechas específico
SELECT analytics.report_clients_debt(jsonb_build_object(
  'start_date', '2024-01-01T00:00:00Z',
  'end_date', '2024-12-31T23:59:59Z'
));
```

### Pruebas de Validación

Ejecutar el archivo `test-clients-debt-report.sql` en el SQL Editor para:

1. Verificar la estructura del Report_Output
2. Validar que debt_balance = total_installments - total_paid
3. Confirmar que todos los clientes tienen debt_balance > 0
4. Validar el cálculo de credit_utilization_pct
5. Verificar que no hay valores NULL en campos numéricos

## Requisitos Cumplidos

✅ **Requirement 5.1**: Calcular debt_balance como installments.amount - paid_amount
✅ **Requirement 5.2**: Filtrar clientes donde debt_balance > 0
✅ **Requirement 1.4**: Usar NULLIF para prevenir división por cero
✅ **Requirement 1.5**: No retornar valores NULL en cálculos numéricos (usar COALESCE)
✅ **Requirement 12.1-12.6**: Retornar estructura Report_Output con kpis, series, rows, meta

## Características Adicionales

- **Cuotas vencidas**: Cuenta y muestra cuotas con status 'OVERDUE'
- **Días de atraso**: Calcula días desde la última fecha de vencimiento
- **Planes activos**: Cuenta planes de crédito activos por cliente
- **Filtrado por fecha**: Permite filtrar planes de crédito por rango de fechas
- **Ordenamiento**: Resultados ordenados por deuda descendente

## Notas Técnicas

1. La función usa CTEs (Common Table Expressions) para claridad y mantenibilidad
2. Todos los cálculos usan COALESCE para garantizar valores no-NULL
3. Las divisiones usan NULLIF en el denominador para prevenir errores
4. Los filtros de fecha se aplican a la creación de planes de crédito
5. Solo se consideran clientes activos (active = true)
6. Solo se consideran planes de crédito activos (status = 'ACTIVE')

## Próximos Pasos

1. Aplicar la función en Supabase usando `apply-clients-debt-function.sql`
2. Ejecutar las pruebas de validación con `test-clients-debt-report.sql`
3. Verificar que la función retorna datos correctos con clientes reales
4. Proceder con la tarea 6.5: Write property tests for debt calculations
