# Corrección de Nombres de Tiendas/Almacenes

## Problema Identificado

El sistema tenía inconsistencias en los nombres de tiendas/almacenes:
- Algunos lugares usaban `TIENDA_MUJERES` y `TIENDA_HOMBRES`
- Otros usaban `Mujeres` y `Hombres`
- Esto causaba confusión entre **LÍNEAS de producto** (Mujeres, Hombres, Niños) y **TIENDAS físicas**

## Solución Implementada

Se estandarizó todo el sistema para usar:
- **`Tienda Mujeres`** - Tienda física de mujeres
- **`Tienda Hombres`** - Tienda física de hombres

## Archivos Corregidos

### Frontend (TypeScript/React):
✅ `components/inventory/bulk-product-entry.tsx`
✅ `components/inventory/bulk-product-entry-v2.tsx`
✅ `components/products/product-form-multi-size.tsx`
✅ `components/products/product-search.tsx`
✅ `components/cash/cash-shift-manager.tsx`
✅ `components/inventory/movements-table.tsx`
✅ `components/reports/reports-generator.tsx`
✅ `app/(auth)/pos/page.tsx`
✅ `app/api/products/search/route.ts`
✅ `actions/reports.ts`

### Base de Datos:
📄 `supabase/FIX_WAREHOUSE_NAMES.sql` - Script de migración creado

## Cómo Ejecutar la Corrección

### Paso 1: Ejecutar el Script SQL

Abre Supabase SQL Editor y ejecuta el archivo:
```
supabase/FIX_WAREHOUSE_NAMES.sql
```

Este script:
1. ✅ Actualiza la tabla `stock` (warehouse_id)
2. ✅ Actualiza la tabla `movements` (warehouse_id)
3. ✅ Actualiza la tabla `sales` (store_id)
4. ✅ Actualiza la tabla `cash_shifts` (store_id)
5. ✅ Actualiza la tabla `users` (stores array)
6. ✅ Verifica que todo esté correcto

### Paso 2: Verificar los Cambios

Después de ejecutar el script, verifica con estas queries:

```sql
-- Verificar stock
SELECT DISTINCT warehouse_id, COUNT(*) 
FROM stock 
GROUP BY warehouse_id;

-- Verificar movimientos
SELECT DISTINCT warehouse_id, COUNT(*) 
FROM movements 
GROUP BY warehouse_id;

-- Verificar ventas
SELECT DISTINCT store_id, COUNT(*) 
FROM sales 
GROUP BY store_id;

-- Verificar turnos de caja
SELECT DISTINCT store_id, COUNT(*) 
FROM cash_shifts 
GROUP BY store_id;

-- Verificar usuarios
SELECT email, stores 
FROM users 
WHERE 'Tienda Mujeres' = ANY(stores) OR 'Tienda Hombres' = ANY(stores);
```

Deberías ver solo:
- `Tienda Mujeres`
- `Tienda Hombres`

### Paso 3: Reiniciar la Aplicación

```bash
# Si estás en desarrollo
npm run dev

# O reinicia el servidor si está corriendo
```

## Resultado Esperado

Después de aplicar estos cambios:

1. ✅ La pantalla de **Stock** mostrará solo dos secciones:
   - **Tienda Mujeres** - Con todos los productos de esa tienda
   - **Tienda Hombres** - Con todos los productos de esa tienda

2. ✅ No habrá confusión entre:
   - **TIENDAS** (ubicaciones físicas): `Tienda Mujeres`, `Tienda Hombres`
   - **LÍNEAS** (categorías de producto): `Mujeres`, `Hombres`, `Niños`, `Accesorios`

3. ✅ Todos los selectores de tienda en la UI mostrarán:
   - Tienda Mujeres
   - Tienda Hombres

4. ✅ Los reportes y movimientos filtrarán correctamente por tienda

## Estructura Conceptual Correcta

```
TIENDA (Store/Warehouse)
├── Tienda Mujeres
│   ├── Productos de línea "Mujeres" (Blusas, Jeans, Vestidos, etc.)
│   ├── Productos de línea "Hombres" (si los hay)
│   └── Productos de línea "Niños" (si los hay)
│
└── Tienda Hombres
    ├── Productos de línea "Hombres" (Polos, Jeans, Camisas, etc.)
    ├── Productos de línea "Mujeres" (si los hay)
    └── Productos de línea "Niños" (si los hay)
```

**Nota importante:** Una tienda puede tener productos de cualquier línea. La línea es una categoría de producto, no una ubicación física.

## Notas Adicionales

- El script SQL usa una transacción (BEGIN/COMMIT) para asegurar que todos los cambios se apliquen correctamente
- Si algo falla, la transacción se revertirá automáticamente
- El script incluye verificaciones para asegurar que la migración fue exitosa
- Los comentarios en las tablas se actualizaron para documentar el formato correcto

## Soporte

Si encuentras algún problema después de ejecutar el script:
1. Verifica que el script se ejecutó completamente sin errores
2. Ejecuta las queries de verificación del Paso 2
3. Revisa los logs de la aplicación para ver si hay errores relacionados con warehouse_id o store_id
