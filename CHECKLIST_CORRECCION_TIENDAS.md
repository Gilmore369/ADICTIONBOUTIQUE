# ✅ Checklist: Corrección de Tiendas

## 📋 Lista de Verificación

### Fase 1: Preparación
- [ ] He leído `RESUMEN_CORRECCION_TIENDAS.md`
- [ ] He leído `EJECUTAR_FIX_WAREHOUSE_NAMES.md`
- [ ] Tengo acceso al Supabase SQL Editor
- [ ] He hecho backup de la base de datos (opcional pero recomendado)

### Fase 2: Ejecución del Script SQL ⚠️ CRÍTICO

- [ ] Abrir Supabase Dashboard
- [ ] Ir a SQL Editor
- [ ] Copiar el contenido de `supabase/FIX_WAREHOUSE_NAMES.sql`
- [ ] Pegar en el editor
- [ ] Ejecutar el script
- [ ] Verificar que no hay errores
- [ ] Verificar los mensajes de NOTICE que aparecen al final

**Mensajes esperados:**
```
NOTICE: === VERIFICACIÓN DE NORMALIZACIÓN ===
NOTICE: Stock normalizados: [número]
NOTICE: Movimientos normalizados: [número]
NOTICE: Ventas normalizadas: [número]
NOTICE: Turnos de caja normalizados: [número]
```

### Fase 3: Verificación de Datos

Ejecutar estas queries y verificar resultados:

#### 3.1 Verificar Stock
```sql
SELECT DISTINCT warehouse_id, COUNT(*) as cantidad
FROM stock 
GROUP BY warehouse_id
ORDER BY warehouse_id;
```
- [ ] Solo aparece "Tienda Hombres"
- [ ] Solo aparece "Tienda Mujeres"
- [ ] NO aparece "TIENDA_HOMBRES", "TIENDA_MUJERES", "Hombres", "Mujeres"

#### 3.2 Verificar Movimientos
```sql
SELECT DISTINCT warehouse_id, COUNT(*) as cantidad
FROM movements 
GROUP BY warehouse_id
ORDER BY warehouse_id;
```
- [ ] Solo aparece "Tienda Hombres"
- [ ] Solo aparece "Tienda Mujeres"

#### 3.3 Verificar Ventas
```sql
SELECT DISTINCT store_id, COUNT(*) as cantidad
FROM sales 
GROUP BY store_id
ORDER BY store_id;
```
- [ ] Solo aparece "Tienda Hombres"
- [ ] Solo aparece "Tienda Mujeres"

#### 3.4 Verificar Turnos de Caja
```sql
SELECT DISTINCT store_id, COUNT(*) as cantidad
FROM cash_shifts 
GROUP BY store_id
ORDER BY store_id;
```
- [ ] Solo aparece "Tienda Hombres"
- [ ] Solo aparece "Tienda Mujeres"

#### 3.5 Verificar Usuarios
```sql
SELECT email, stores 
FROM users 
WHERE 'Tienda Mujeres' = ANY(stores) OR 'Tienda Hombres' = ANY(stores)
LIMIT 5;
```
- [ ] Los arrays de stores contienen "Tienda Mujeres" y/o "Tienda Hombres"
- [ ] NO contienen "TIENDA_MUJERES", "TIENDA_HOMBRES", etc.

### Fase 4: Verificación de Código

Los siguientes archivos ya fueron actualizados:

- [ ] `components/inventory/bulk-product-entry.tsx`
- [ ] `components/inventory/bulk-product-entry-v2.tsx`
- [ ] `components/products/product-form-multi-size.tsx`
- [ ] `components/products/product-search.tsx`
- [ ] `components/cash/cash-shift-manager.tsx`
- [ ] `components/inventory/movements-table.tsx`
- [ ] `components/reports/reports-generator.tsx`
- [ ] `app/(auth)/pos/page.tsx`
- [ ] `app/api/products/search/route.ts`
- [ ] `actions/reports.ts`
- [ ] `config/constants.ts`

### Fase 5: Pruebas de la Aplicación

#### 5.1 Reiniciar Aplicación
```bash
npm run dev
```
- [ ] La aplicación inicia sin errores
- [ ] No hay errores en la consola del navegador

#### 5.2 Probar Pantalla de Stock
- [ ] Ir a: Inventario → Stock
- [ ] Verificar que aparecen solo dos secciones:
  - [ ] "Tienda Mujeres"
  - [ ] "Tienda Hombres"
- [ ] NO aparecen secciones con nombres antiguos
- [ ] Los productos se muestran correctamente en cada tienda

#### 5.3 Probar Ingreso de Productos
- [ ] Ir a: Inventario → Ingreso Masivo
- [ ] Verificar selector de tienda muestra:
  - [ ] "Tienda Mujeres"
  - [ ] "Tienda Hombres"
- [ ] Crear un producto de prueba
- [ ] Verificar que se guarda correctamente
- [ ] Verificar que aparece en Stock con el nombre correcto de tienda

#### 5.4 Probar POS (Punto de Venta)
- [ ] Ir a: POS
- [ ] Verificar selector de tienda muestra:
  - [ ] "Tienda Mujeres"
  - [ ] "Tienda Hombres"
- [ ] Buscar un producto
- [ ] Verificar que muestra stock de la tienda seleccionada
- [ ] Hacer una venta de prueba
- [ ] Verificar que se guarda con el store_id correcto

#### 5.5 Probar Caja
- [ ] Ir a: Caja
- [ ] Verificar selector de tienda muestra:
  - [ ] "Tienda Hombres"
  - [ ] "Tienda Mujeres"
- [ ] Intentar abrir turno para una tienda
- [ ] Verificar que se abre correctamente

#### 5.6 Probar Reportes
- [ ] Ir a: Reportes
- [ ] Verificar filtro de tienda muestra:
  - [ ] "Todas"
  - [ ] "Tienda Hombres"
  - [ ] "Tienda Mujeres"
- [ ] Generar un reporte filtrado por tienda
- [ ] Verificar que los datos son correctos

#### 5.7 Probar Movimientos
- [ ] Ir a: Inventario → Movimientos
- [ ] Verificar filtro de tienda muestra:
  - [ ] "Ambas tiendas"
  - [ ] "Tienda Mujeres"
  - [ ] "Tienda Hombres"
- [ ] Filtrar por cada tienda
- [ ] Verificar que los movimientos se filtran correctamente

### Fase 6: Verificación Final

- [ ] Todas las pantallas funcionan correctamente
- [ ] No hay errores en la consola
- [ ] Los nombres de tienda son consistentes en toda la aplicación
- [ ] Los datos se guardan con los nombres correctos
- [ ] Los filtros funcionan correctamente

## 🎉 Completado

Si todos los checkboxes están marcados, la corrección fue exitosa!

## ❌ Si algo falló

### Problema: El script SQL dio error

**Solución:**
1. Lee el mensaje de error
2. Verifica que no haya transacciones abiertas
3. Intenta ejecutar el script nuevamente
4. Si persiste, contacta soporte

### Problema: Aparecen nombres antiguos en la UI

**Solución:**
1. Verifica que ejecutaste el script SQL
2. Reinicia la aplicación
3. Limpia el caché del navegador (Ctrl+Shift+R)
4. Verifica las queries de la Fase 3

### Problema: Los productos no se guardan

**Solución:**
1. Abre la consola del navegador (F12)
2. Busca errores relacionados con warehouse_id
3. Verifica que el script SQL se ejecutó correctamente
4. Verifica las queries de la Fase 3

### Problema: Los filtros no funcionan

**Solución:**
1. Verifica que los datos en la BD tienen los nombres correctos
2. Ejecuta las queries de verificación de la Fase 3
3. Si los datos están mal, ejecuta el script SQL nuevamente

## 📞 Soporte

Si necesitas ayuda:
1. Revisa `EJECUTAR_FIX_WAREHOUSE_NAMES.md`
2. Revisa `RESUMEN_CORRECCION_TIENDAS.md`
3. Verifica los logs de la aplicación
4. Verifica los datos en la base de datos

## 📝 Notas

- Este checklist debe completarse en orden
- No saltes pasos
- Si un paso falla, no continúes hasta resolverlo
- Guarda este checklist para futuras referencias
