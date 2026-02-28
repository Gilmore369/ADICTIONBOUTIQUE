# Implementación de la Función Kardex

## Resumen

Se ha implementado la función `analytics.report_kardex` que lista todos los movimientos de inventario con balance acumulado (running balance), ordenados cronológicamente.

## Características Implementadas

### 1. Cálculo de Balance Acumulado (Running Balance)

La función utiliza una **window function** de PostgreSQL para calcular el balance acumulado de cada producto en cada almacén:

```sql
SUM(
  CASE 
    WHEN m.type = 'ENTRADA' THEN m.quantity
    WHEN m.type = 'SALIDA' THEN -m.quantity
    WHEN m.type = 'AJUSTE' THEN m.quantity
    WHEN m.type = 'TRASPASO' THEN m.quantity
    ELSE 0
  END
) OVER (
  PARTITION BY m.product_id, m.warehouse_id 
  ORDER BY m.created_at, m.id
)
```

**Explicación:**
- **ENTRADA**: Suma la cantidad al balance
- **SALIDA**: Resta la cantidad del balance (por eso se multiplica por -1)
- **AJUSTE**: Suma la cantidad (puede ser positiva o negativa)
- **TRASPASO**: Suma la cantidad
- **PARTITION BY**: Calcula el balance por separado para cada combinación producto-almacén
- **ORDER BY**: Ordena por fecha de creación y luego por ID para garantizar orden consistente

### 2. Ordenamiento Cronológico

Los movimientos se ordenan por `created_at ASC, id ASC` para cumplir con el requisito 2.8:
- Primero por fecha de creación (ascendente)
- Luego por ID (para desempatar movimientos con la misma fecha)

### 3. Filtros Soportados

La función acepta los siguientes filtros opcionales:

| Filtro | Tipo | Descripción | Valor por Defecto |
|--------|------|-------------|-------------------|
| `start_date` | timestamptz | Fecha inicial | NOW() - 30 días |
| `end_date` | timestamptz | Fecha final | NOW() |
| `warehouse_id` | text | ID del almacén | NULL (todos) |
| `product_id` | uuid | ID del producto | NULL (todos) |

### 4. KPIs Generados

La función retorna 5 KPIs principales:

1. **Total Movimientos**: Cantidad total de movimientos en el período
2. **Entradas**: Cantidad de movimientos tipo ENTRADA
3. **Salidas**: Cantidad de movimientos tipo SALIDA
4. **Ajustes**: Cantidad de movimientos tipo AJUSTE
5. **Productos Afectados**: Cantidad de productos únicos con movimientos

### 5. Series para Gráficos

Se generan 2 series para visualización:

1. **Movimientos por Tipo**: Gráfico de barras/pie mostrando distribución por tipo
2. **Balance Acumulado en el Tiempo**: Gráfico de líneas mostrando evolución del balance (últimos 50 movimientos)

### 6. Columnas en la Tabla de Datos

| Columna | Tipo | Descripción |
|---------|------|-------------|
| date | date | Fecha y hora del movimiento (YYYY-MM-DD HH24:MI:SS) |
| warehouseId | string | ID del almacén |
| barcode | string | Código de barras del producto |
| productName | string | Nombre del producto |
| type | string | Tipo de movimiento (ENTRADA, SALIDA, AJUSTE, TRASPASO) |
| quantity | number | Cantidad del movimiento (valor absoluto) |
| runningBalance | number | Balance acumulado hasta ese movimiento |
| reference | string | Referencia del movimiento |
| notes | string | Notas adicionales |

## Instalación

### Opción 1: Ejecutar en Supabase SQL Editor

1. Abre el SQL Editor en tu proyecto de Supabase
2. Copia y pega el contenido de `ADD_KARDEX_FUNCTION.sql`
3. Ejecuta el script
4. Verifica que aparezca el mensaje: "Función analytics.report_kardex creada exitosamente"

### Opción 2: Aplicar la Migración Completa

Si estás configurando el proyecto desde cero, la función ya está incluida en:
```
supabase/migrations/20240302000000_analytics_reports.sql
```

## Pruebas

### Ejecutar Tests

Ejecuta el archivo `TEST_KARDEX_FUNCTION.sql` en el SQL Editor para verificar:

1. ✅ La función se ejecuta sin errores
2. ✅ Los movimientos están ordenados cronológicamente
3. ✅ El balance acumulado se calcula correctamente
4. ✅ Los KPIs se generan correctamente
5. ✅ La estructura de columnas es correcta

### Ejemplo de Uso

```sql
-- Kardex de todos los productos (últimos 30 días)
SELECT analytics.report_kardex('{}');

-- Kardex de un producto específico
SELECT analytics.report_kardex(jsonb_build_object(
  'product_id', 'uuid-del-producto'
));

-- Kardex de un almacén en un rango de fechas
SELECT analytics.report_kardex(jsonb_build_object(
  'warehouse_id', 'ALM-001',
  'start_date', '2025-01-01T00:00:00Z',
  'end_date', '2025-01-31T23:59:59Z'
));
```

## Validación de Requisitos

### ✅ Requirement 2.7
> WHEN the kardex report is requested, THE Report_Engine SHALL list all movements with running balance calculation

**Implementado:** La función lista todos los movimientos con el campo `runningBalance` calculado usando window functions.

### ✅ Requirement 2.8
> THE Report_Engine SHALL order kardex movements by date ascending

**Implementado:** Los movimientos se ordenan por `created_at ASC, id ASC` en la cláusula final del query.

## Estructura de Respuesta

```json
{
  "kpis": [
    {"label": "Total Movimientos", "value": 150, "format": "number"},
    {"label": "Entradas", "value": 80, "format": "number"},
    {"label": "Salidas", "value": 60, "format": "number"},
    {"label": "Ajustes", "value": 10, "format": "number"},
    {"label": "Productos Afectados", "value": 25, "format": "number"}
  ],
  "series": [
    {
      "name": "Movimientos por Tipo",
      "points": [
        {"x": "ENTRADA", "y": 80},
        {"x": "SALIDA", "y": 60},
        {"x": "AJUSTE", "y": 10}
      ]
    },
    {
      "name": "Balance Acumulado en el Tiempo",
      "points": [
        {"x": "2025-01-15 10:30", "y": 100},
        {"x": "2025-01-15 14:20", "y": 95},
        {"x": "2025-01-16 09:15", "y": 110}
      ]
    }
  ],
  "rows": [
    {
      "date": "2025-01-15 10:30:00",
      "warehouseId": "ALM-001",
      "barcode": "7501234567890",
      "productName": "Producto A",
      "type": "ENTRADA",
      "quantity": 100,
      "runningBalance": 100,
      "reference": "COMPRA-001",
      "notes": "Compra inicial"
    },
    {
      "date": "2025-01-15 14:20:00",
      "warehouseId": "ALM-001",
      "barcode": "7501234567890",
      "productName": "Producto A",
      "type": "SALIDA",
      "quantity": 5,
      "runningBalance": 95,
      "reference": "VENTA-001",
      "notes": ""
    }
  ],
  "meta": {
    "columns": [
      {"key": "date", "label": "Fecha", "type": "date"},
      {"key": "warehouseId", "label": "Almacén", "type": "string"},
      {"key": "barcode", "label": "Código", "type": "string"},
      {"key": "productName", "label": "Producto", "type": "string"},
      {"key": "type", "label": "Tipo", "type": "string"},
      {"key": "quantity", "label": "Cantidad", "type": "number"},
      {"key": "runningBalance", "label": "Balance Acumulado", "type": "number"},
      {"key": "reference", "label": "Referencia", "type": "string"},
      {"key": "notes", "label": "Notas", "type": "string"}
    ]
  }
}
```

## Optimización de Performance

La función utiliza los siguientes índices (ya creados en la migración `20240303000000_analytics_logging_and_indexes.sql`):

```sql
CREATE INDEX idx_movements_created_at ON movements(created_at);
CREATE INDEX idx_movements_product_id ON movements(product_id);
CREATE INDEX idx_movements_type ON movements(type);
CREATE INDEX idx_movements_composite ON movements(created_at, product_id, type);
CREATE INDEX idx_movements_warehouse_id ON movements(warehouse_id);
```

Estos índices optimizan:
- Filtrado por rango de fechas
- Filtrado por producto
- Filtrado por almacén
- Agrupación por tipo de movimiento

## Próximos Pasos

1. ✅ Ejecutar `ADD_KARDEX_FUNCTION.sql` en Supabase SQL Editor
2. ✅ Ejecutar `TEST_KARDEX_FUNCTION.sql` para verificar
3. ⏭️ Integrar con el API Layer (task 8.1)
4. ⏭️ Crear componente UI para visualizar el kardex (task 9.x)
5. ⏭️ Implementar exportación a CSV/Excel/PDF (task 11.x)

## Notas Técnicas

### Window Functions vs Subqueries

Se eligió usar **window functions** en lugar de subqueries recursivas porque:
- ✅ Mejor performance (una sola pasada sobre los datos)
- ✅ Código más limpio y mantenible
- ✅ Soporte nativo de PostgreSQL para cálculos acumulados
- ✅ Permite particionar por producto y almacén fácilmente

### Manejo de Tipos de Movimiento

El cálculo del balance considera:
- **ENTRADA**: Incrementa el stock (+quantity)
- **SALIDA**: Decrementa el stock (-quantity)
- **AJUSTE**: Puede incrementar o decrementar (±quantity)
- **TRASPASO**: Incrementa el stock en el almacén destino (+quantity)

### Formato de Fechas

Las fechas se formatean como `YYYY-MM-DD HH24:MI:SS` para:
- ✅ Compatibilidad con ISO 8601
- ✅ Ordenamiento correcto como string
- ✅ Legibilidad para el usuario
- ✅ Precisión hasta segundos

## Soporte

Si encuentras algún problema:
1. Verifica que el schema `analytics` existe
2. Verifica que tienes permisos de `authenticated`
3. Verifica que la tabla `movements` tiene datos
4. Ejecuta los tests en `TEST_KARDEX_FUNCTION.sql`
