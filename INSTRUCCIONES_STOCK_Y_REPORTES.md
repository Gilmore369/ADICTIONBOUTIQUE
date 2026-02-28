# Instrucciones para Agregar Stock y Verificar Reportes

## 1. Ejecutar Script de Stock

### Archivo a ejecutar:
`supabase/ADD_STOCK_ONLY.sql`

### Pasos:
1. Abrir Supabase Dashboard
2. Ir a SQL Editor
3. Copiar y pegar el contenido de `supabase/ADD_STOCK_ONLY.sql`
4. Ejecutar el script

### ¿Qué hace el script?

El script crea stock y movimientos para todos los productos existentes:

- **Stock actual**: Cantidad aleatoria entre 50-150 unidades por producto por tienda
- **Movimiento de entrada inicial**: Cantidad vendida + stock actual (registrado hace 90 días)
- **Movimientos de salida**: Uno por cada venta realizada

### Lógica del cálculo:

```
Para cada producto en cada tienda:
  1. Calcular cuánto se vendió = SUM(sale_items.quantity)
  2. Stock actual = Random(50-150)
  3. Stock inicial = Vendido + Stock actual
  4. Crear entrada inicial con stock inicial
  5. Crear salidas por cada venta
  6. Stock final = Stock actual (positivo, sin errores)
```

### Verificación después de ejecutar:

El script mostrará automáticamente:
- Total de registros en stock
- Total de movimientos
- Stock por tienda
- Movimientos por tipo

## 2. Reportes Corregidos

Se corrigieron todos los reportes para usar los nombres correctos de columnas:

### Cambios realizados:
- ❌ `cost_price` → ✅ `purchase_price`
- ❌ `sale_price` → ✅ `price`
- ❌ `inventory_movements` → ✅ `movements`
- ❌ `movement_type` → ✅ `type`

### Reportes disponibles:

1. **Rotación de Stock**
   - Muestra productos más vendidos
   - Calcula índice de rotación = Vendido / Stock actual
   - Ordena por cantidad vendida

2. **Valorización de Inventario**
   - Muestra valor del inventario actual
   - Calcula: Costo total, Valor de venta, Ganancia potencial
   - Filtra por categoría (opcional)

3. **Stock Bajo**
   - Productos con stock menor al mínimo (default: 5)
   - Muestra estado: "Agotado" o "Stock Bajo"
   - Ordena por cantidad ascendente

4. **Kardex**
   - Historial de movimientos de inventario
   - Muestra entradas y salidas
   - Filtra por producto, tienda, fechas

5. **Ventas por Período**
   - Lista de ventas en rango de fechas
   - Muestra tipo (Contado/Crédito)
   - Filtra por tienda

6. **Ventas por Mes**
   - Agrupa ventas por día
   - Separa contado y crédito
   - Muestra totales

7. **Resumen de Ventas**
   - Estadísticas generales
   - Total ventas, ingresos, promedio
   - Comparación contado vs crédito

8. **Ventas por Producto**
   - Productos más vendidos
   - Cantidad y monto total
   - Número de transacciones

9. **Ventas por Categoría**
   - Ventas agrupadas por categoría
   - Cantidad de productos diferentes
   - Total de ingresos

## 3. Verificar Reportes

Después de ejecutar el script de stock:

1. Ir a `/reports` en la aplicación
2. Probar cada reporte:
   - Rotación de Stock
   - Valorización de Inventario
   - Kardex
   - Stock Bajo
   - Ventas por Producto
   - Ventas por Categoría

3. Verificar que:
   - ✅ Muestran datos reales (no "No se encontraron datos")
   - ✅ Los cálculos son correctos
   - ✅ Se pueden exportar a Excel, PDF, CSV

## 4. Estructura de Datos Creada

### Stock (tabla `stock`):
- ~200 registros (100 productos × 2 tiendas)
- Cantidad: 50-150 unidades por producto
- warehouse_id: TIENDA_HOMBRES, TIENDA_MUJERES

### Movimientos (tabla `movements`):
- ~200 entradas iniciales (una por producto por tienda)
- ~1,800 salidas (una por cada venta)
- Total: ~2,000 movimientos

### Tipos de movimientos:
- **ENTRADA**: Stock inicial (hace 90 días)
- **SALIDA**: Ventas realizadas (fechas de las ventas)

## 5. Próximos Pasos (Opcional)

Si deseas gráficos más profesionales:

1. Considerar usar bibliotecas de visualización:
   - Recharts (ya instalado)
   - Chart.js
   - D3.js
   - Plotly

2. Agregar más métricas:
   - Margen de ganancia por producto
   - Tendencias de ventas
   - Predicción de stock
   - Análisis ABC de productos

3. Exportación avanzada:
   - Gráficos en PDF
   - Dashboards interactivos
   - Reportes programados

## Notas Importantes

- El script es seguro: limpia stock y movimientos anteriores antes de crear nuevos
- No afecta ventas, clientes, productos, ni otros datos
- Se puede ejecutar múltiples veces sin problemas
- Los movimientos de salida se crean automáticamente desde las ventas existentes
