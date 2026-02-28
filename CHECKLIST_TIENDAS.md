# ✅ Checklist: Corrección de Tiendas

## 📦 Cambios en el Código (Completados)

- [x] `components/products/product-search.tsx` - Default: `'Tienda Mujeres'`
- [x] `components/products/product-form-multi-size.tsx` - Selects actualizados
- [x] `components/inventory/bulk-product-entry.tsx` - Selects actualizados
- [x] `components/inventory/bulk-product-entry-v2.tsx` - Selects actualizados
- [x] `components/inventory/movements-table.tsx` - Filtros actualizados
- [x] `components/cash/cash-shift-manager.tsx` - Tiendas actualizadas
- [x] `components/reports/reports-generator.tsx` - Filtros actualizados
- [x] `app/(auth)/pos/page.tsx` - Selects actualizados
- [x] `app/api/products/search/route.ts` - Default actualizado
- [x] `actions/reports.ts` - Mapeo actualizado

## 🗄️ Base de Datos (Pendiente)

- [ ] **EJECUTAR:** `supabase/migrations/20260227000002_fix_store_names.sql`

### Cómo ejecutar:
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia el contenido del archivo
4. Ejecuta
5. Verifica los mensajes de éxito

## ✅ Verificación Post-Ejecución

### 1. Verificar Base de Datos
```sql
-- Ejecuta esto en Supabase SQL Editor
SELECT DISTINCT warehouse_id FROM stock ORDER BY warehouse_id;
```
- [ ] Solo aparece: `Tienda Hombres` y `Tienda Mujeres`
- [ ] NO aparece: `TIENDA_MUJERES`, `TIENDA_HOMBRES`, `Mujeres`, `Hombres`

### 2. Verificar Aplicación

#### Stock
- [ ] Ve a: **Inventario → Stock**
- [ ] Ves exactamente 2 secciones: `Tienda Mujeres` y `Tienda Hombres`
- [ ] NO ves secciones con nombres antiguos

#### Ingreso de Productos
- [ ] Ve a: **Inventario → Ingreso Masivo**
- [ ] El selector muestra: `Tienda Mujeres` y `Tienda Hombres`

#### POS
- [ ] Ve a: **POS**
- [ ] El selector muestra: `Tienda Mujeres` y `Tienda Hombres`

#### Reportes
- [ ] Ve a: **Reportes**
- [ ] El filtro muestra: `Todas`, `Tienda Hombres`, `Tienda Mujeres`

#### Caja
- [ ] Ve a: **Caja**
- [ ] Al abrir turno muestra: `Tienda Hombres` y `Tienda Mujeres`

### 3. Pruebas Funcionales

#### Crear Producto
- [ ] Crea un producto nuevo
- [ ] Selecciona una tienda
- [ ] El producto se crea correctamente
- [ ] Aparece en el stock de la tienda correcta

#### Hacer una Venta
- [ ] Ve al POS
- [ ] Selecciona una tienda
- [ ] Realiza una venta
- [ ] La venta se registra con la tienda correcta

#### Ver Movimientos
- [ ] Ve a: **Inventario → Movimientos**
- [ ] Filtra por tienda
- [ ] Los movimientos se filtran correctamente

## 🔧 Solución de Problemas

### Si ves nombres antiguos en la UI:
- [ ] Limpia caché del navegador (Ctrl + Shift + R)
- [ ] Reinicia el servidor de desarrollo
- [ ] Verifica que ejecutaste el script SQL

### Si hay errores al crear productos:
- [ ] Verifica que el script SQL se ejecutó
- [ ] Revisa la consola del navegador
- [ ] Verifica los logs del servidor

### Si el stock no se muestra:
```sql
-- Verifica que todos los registros están correctos
SELECT warehouse_id, COUNT(*) 
FROM stock 
GROUP BY warehouse_id;
```
- [ ] Solo aparecen: `Tienda Hombres` y `Tienda Mujeres`

## 📊 Resumen de Cambios

### Tablas Afectadas:
- [ ] `stock.warehouse_id` actualizado
- [ ] `movements.warehouse_id` actualizado
- [ ] `sales.store_id` actualizado
- [ ] `cash_shifts.store_id` actualizado
- [ ] `users.stores` actualizado

### Valores Estandarizados:
- ✅ **Antes:** `TIENDA_MUJERES`, `Mujeres`, `MUJERES`
- ✅ **Ahora:** `Tienda Mujeres`

- ✅ **Antes:** `TIENDA_HOMBRES`, `Hombres`, `HOMBRES`
- ✅ **Ahora:** `Tienda Hombres`

## 🎉 Completado

Una vez que todos los checkboxes estén marcados:
- ✅ El código está actualizado
- ✅ La base de datos está actualizada
- ✅ La aplicación funciona correctamente
- ✅ No hay confusión entre tiendas y líneas

---

## 📝 Notas Finales

**Recuerda:**
- Las TIENDAS son ubicaciones físicas: `Tienda Mujeres`, `Tienda Hombres`
- Las LÍNEAS son categorías de productos: `Mujeres`, `Hombres`, `Niños`, `Accesorios`
- Un producto de la línea "Mujeres" se guarda en la tienda "Tienda Mujeres"
- El stock se gestiona por TIENDA, no por LÍNEA

---

**Estado Actual:** 
- Código: ✅ COMPLETADO
- Base de Datos: ⏳ PENDIENTE (ejecutar script SQL)
- Verificación: ⏳ PENDIENTE (después de ejecutar script)
