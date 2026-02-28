# Corrección de Nombres de Tiendas

## Problema Identificado

El sistema tenía una inconsistencia en los nombres de las tiendas/almacenes:
- Algunos lugares usaban `TIENDA_MUJERES` y `TIENDA_HOMBRES`
- Otros lugares usaban `Mujeres` y `Hombres`
- Esto causaba confusión entre las LÍNEAS de productos y las TIENDAS físicas

## Solución Implementada

Se estandarizó todo el sistema para usar:
- **`Tienda Mujeres`** - Tienda física de mujeres
- **`Tienda Hombres`** - Tienda física de hombres

## Archivos Corregidos

### Frontend (TypeScript/React):
1. ✅ `components/products/product-search.tsx`
2. ✅ `components/products/product-form-multi-size.tsx`
3. ✅ `components/inventory/bulk-product-entry.tsx`
4. ✅ `components/inventory/bulk-product-entry-v2.tsx`
5. ✅ `components/inventory/movements-table.tsx`
6. ✅ `components/cash/cash-shift-manager.tsx`
7. ✅ `components/reports/reports-generator.tsx`
8. ✅ `app/(auth)/pos/page.tsx`
9. ✅ `app/api/products/search/route.ts`
10. ✅ `actions/reports.ts`

### Base de Datos:
- ✅ Script SQL creado: `supabase/FIX_WAREHOUSE_NAMES.sql`

## Pasos para Aplicar la Corrección

### 1. Ejecutar el Script SQL

Abre Supabase SQL Editor y ejecuta el archivo:
```sql
supabase/FIX_WAREHOUSE_NAMES.sql
```

Este script:
- Actualiza `stock.warehouse_id`
- Actualiza `movements.warehouse_id`
- Actualiza `sales.store_id`
- Actualiza `cash_shifts.store_id`
- Actualiza `users.stores` (array)
- Muestra un resumen de los cambios

### 2. Verificar los Cambios

Después de ejecutar el script, verifica que todo esté correcto:

```sql
-- Ver stock por tienda
SELECT warehouse_id, COUNT(*) as productos
FROM stock
GROUP BY warehouse_id;

-- Resultado esperado:
-- Tienda Mujeres | X productos
-- Tienda Hombres | Y productos
```

### 3. Reiniciar la Aplicación

Si tienes la aplicación corriendo:
```bash
# Detener el servidor
Ctrl + C

# Reiniciar
npm run dev
```

## Estructura Clarificada

### TIENDAS (Ubicaciones Físicas):
- **Tienda Mujeres** - Almacén/tienda física de productos femeninos
- **Tienda Hombres** - Almacén/tienda física de productos masculinos

### LÍNEAS (Categorías de Productos):
- **Mujeres** - Línea de productos femeninos (Blusas, Jeans, Vestidos, etc.)
- **Hombres** - Línea de productos masculinos (Polos, Camisas, Jeans, etc.)
- **Niños** - Línea de productos infantiles
- **Accesorios** - Línea de accesorios

### Relación:
- Un producto de la LÍNEA "Mujeres" puede estar en la TIENDA "Tienda Mujeres"
- Un producto de la LÍNEA "Hombres" puede estar en la TIENDA "Tienda Hombres"
- El stock se maneja por TIENDA, no por LÍNEA

## Resultado Esperado

Después de aplicar estos cambios:

1. ✅ En la pantalla de Stock verás solo dos secciones:
   - **Tienda Mujeres**
   - **Tienda Hombres**

2. ✅ No habrá confusión entre líneas y tiendas

3. ✅ Todos los formularios usarán los mismos nombres

4. ✅ Los reportes mostrarán correctamente las tiendas

## Notas Importantes

- Los productos siguen teniendo su `line_id` que indica si son de la línea Mujeres, Hombres, Niños, etc.
- El `warehouse_id` en stock indica en qué tienda física está el producto
- Un producto puede estar en ambas tiendas con diferentes cantidades
