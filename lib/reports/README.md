# Sistema de Reportes Analytics

Sistema completo de reportes con análisis SQL, visualizaciones y insights automáticos.

## Arquitectura

### 1. SQL Analytics Layer (`supabase/migrations/20240302000000_analytics_reports.sql`)

Schema `analytics` con funciones RPC que devuelven datos estructurados:

```typescript
{
  kpis: Array<{label: string, value: number, format: 'number'|'currency'|'percent'}>,
  series: Array<{name: string, points: Array<{x: string, y: number}>}>,
  rows: Array<Record<string, any>>,
  meta: {columns: Array<{key: string, label: string, type: string}>}
}
```

#### Funciones Disponibles

- `analytics.report_inventory_rotation(filters)` - Rotación de inventario
- `analytics.report_inventory_valuation(filters)` - Valorización de inventario
- `analytics.report_sales_timeline(filters)` - Timeline de ventas
- `analytics.report_sales_by_product(filters)` - Ventas por producto
- `analytics.report_sales_by_category(filters)` - Ventas por categoría
- `analytics.report_profit_margin(filters)` - Margen de ganancia
- `analytics.report_clients_debt(filters)` - Deuda de clientes
- `analytics.report_cash_flow(filters)` - Flujo de caja

#### Filtros Soportados

```typescript
{
  start_date?: string,      // ISO timestamp
  end_date?: string,        // ISO timestamp
  store_id?: string,        // ID de tienda
  warehouse_id?: string,    // ID de almacén
  category_id?: uuid,       // ID de categoría
  product_id?: uuid,        // ID de producto
  min_stock?: number        // Stock mínimo
}
```

### 2. Actions Layer (`actions/reports.ts`)

Función unificada para llamar a las RPC:

```typescript
import { generateReport } from '@/actions/reports'

const result = await generateReport('inventory-rotation', {
  start_date: '2024-01-01',
  end_date: '2024-03-01',
  store_id: 'TIENDA_HOMBRES'
})

// result.kpis - KPIs calculados
// result.series - Datos para gráficos
// result.rows - Datos tabulares
// result.meta - Metadata de columnas
```

### 3. Visualización (`components/reports/report-charts.tsx`)

Componentes de gráficos optimizados para cada tipo de reporte:

- Bar charts para rotación, ventas por producto/categoría
- Line charts para timeline de ventas y flujo de caja
- Pie charts para crédito vs contado
- Gráficos combinados para análisis complejos

### 4. Insights Automáticos (`lib/reports/insights.ts`)

Sistema de análisis que genera recomendaciones automáticas:

```typescript
import { generateInsights } from '@/lib/reports/insights'

const insights = generateInsights('inventory-rotation', data)
// Retorna array de insights con tipo, título y mensaje
```

#### Tipos de Insights

- **warning**: Situaciones que requieren atención
- **error**: Problemas críticos que requieren acción inmediata
- **success**: Indicadores positivos
- **info**: Información relevante

#### Análisis Implementados

1. **Rotación de Inventario**
   - Detecta sobrestock (rotación < 0.5 en >30% productos)
   - Identifica productos sin movimiento
   - Destaca productos estrella (rotación > 2)

2. **Margen de Ganancia**
   - Alerta si margen promedio < 20%
   - Detecta productos con margen negativo
   - Reconoce márgenes saludables (>40%)

3. **Deuda de Clientes**
   - Identifica clientes cerca del límite (>80% utilización)
   - Alerta si >30% clientes tienen cuotas vencidas
   - Muestra deuda total de cartera

4. **Ventas por Categoría**
   - Detecta concentración alta (>50% en una categoría)
   - Reconoce buena diversificación

5. **Flujo de Caja**
   - Alerta si flujo es negativo
   - Advierte si gastos >70% de ingresos
   - Reconoce flujo positivo

## Uso

### Generar Reporte

```typescript
// En componente
import { generateReport } from '@/actions/reports'

const handleGenerate = async () => {
  const result = await generateReport('sales-by-product', {
    start_date: '2024-01-01',
    end_date: '2024-03-31',
    store_id: 'TIENDA_HOMBRES'
  })
  
  setReportData(result.rows)
  setInsights(generateInsights('sales-by-product', result.rows))
}
```

### Agregar Nuevo Reporte

1. **Crear función SQL** en `analytics_reports.sql`:

```sql
CREATE OR REPLACE FUNCTION analytics.report_mi_reporte(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(...),
    'series', jsonb_build_array(...),
    'rows', (...),
    'meta', jsonb_build_object(...)
  ) INTO result
  FROM ...;
  
  RETURN result;
END;
$$;
```

2. **Agregar tipo** en `lib/reports/report-types.ts`:

```typescript
MI_REPORTE: {
  id: 'mi-reporte',
  name: 'Mi Reporte',
  category: 'sales',
  description: 'Descripción del reporte'
}
```

3. **Agregar gráfico** en `components/reports/report-charts.tsx`:

```typescript
case 'mi-reporte':
  return <MiReporteChart data={data} />
```

4. **Agregar análisis** (opcional) en `lib/reports/insights.ts`:

```typescript
export function analyzeMiReporte(data: any[]): Insight[] {
  // Lógica de análisis
  return insights
}
```

## Reglas Críticas SQL

1. **NUNCA devolver 'N/A'** - usar `NULLIF` y `COALESCE`
2. **División segura**: `valor / NULLIF(divisor, 0)`
3. **Precio de compra**: `COALESCE(purchase_price, 0)`
4. **Filtrar ventas anuladas**: `WHERE voided = false`
5. **Rotación**: `total_sold / NULLIF(stock_final, 0)`
6. **Margen**: `(revenue - cogs) / NULLIF(revenue, 0) * 100`

## Formato de Datos

### KPIs
```typescript
{
  label: 'Total Ventas',
  value: 1500,
  format: 'number' | 'currency' | 'percent'
}
```

### Series (para gráficos)
```typescript
{
  name: 'Ventas Diarias',
  points: [
    {x: '2024-01-01', y: 1500},
    {x: '2024-01-02', y: 2000}
  ]
}
```

### Rows (datos tabulares)
```typescript
[
  {
    barcode: '123456',
    name: 'Producto A',
    quantity: 10,
    total: 150.50
  }
]
```

### Meta (metadata de columnas)
```typescript
{
  columns: [
    {key: 'barcode', label: 'Código', type: 'string'},
    {key: 'total', label: 'Total', type: 'currency'}
  ]
}
```

## Exportación

Los reportes se pueden exportar en 3 formatos:
- **CSV**: Datos tabulares simples
- **Excel**: Con formato y múltiples hojas
- **PDF**: Documento imprimible

```typescript
import { exportReport } from '@/lib/reports/export-utils'

exportReport({
  filename: 'reporte-ventas',
  title: 'Reporte de Ventas',
  headers: ['Producto', 'Cantidad', 'Total'],
  data: [['Producto A', '10', '150.50']],
  format: 'excel'
})
```

## Migración

Para ejecutar la migración:

```bash
# Usando Supabase CLI
supabase db push

# O manualmente en el dashboard de Supabase
# SQL Editor > Pegar contenido de analytics_reports.sql > Run
```

## Testing

Probar funciones RPC directamente:

```sql
-- Test rotación de inventario
SELECT analytics.report_inventory_rotation(
  '{"start_date": "2024-01-01", "end_date": "2024-03-31"}'::jsonb
);

-- Test ventas por producto
SELECT analytics.report_sales_by_product(
  '{"start_date": "2024-01-01", "store_id": "TIENDA_HOMBRES"}'::jsonb
);
```

## Troubleshooting

### Error: function does not exist
- Verificar que la migración se ejecutó correctamente
- Verificar permisos: `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO authenticated`

### Error: division by zero
- Revisar uso de `NULLIF` en divisiones
- Usar `COALESCE` para valores nulos

### Datos vacíos
- Verificar filtros de fecha
- Verificar que existan datos en el período
- Revisar filtro `voided = false` en ventas

## Performance

- Las funciones usan índices existentes en las tablas
- Limitar resultados con `LIMIT` en subconsultas
- Usar `INNER JOIN` cuando sea posible
- Evitar `SELECT *`, especificar columnas necesarias
