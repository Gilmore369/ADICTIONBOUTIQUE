# ✅ Corrección Completa: Estandarización de Nombres de Tiendas

## 📋 Resumen

Se ha corregido la inconsistencia en los nombres de tiendas/almacenes en todo el sistema.

### Antes (Inconsistente):
- ❌ `TIENDA_MUJERES` / `TIENDA_HOMBRES`
- ❌ `Mujeres` / `Hombres`
- ❌ Confusión entre LÍNEAS de productos y TIENDAS físicas

### Ahora (Estandarizado):
- ✅ `Tienda Mujeres` - Tienda física de mujeres
- ✅ `Tienda Hombres` - Tienda física de hombres
- ✅ Separación clara entre tiendas y líneas de productos

---

## 🎯 Conceptos Clarificados

### TIENDAS (Ubicaciones Físicas)
Son los almacenes/locales físicos donde se guarda y vende el inventario:
- **Tienda Mujeres** - Local físico 1
- **Tienda Hombres** - Local físico 2

### LÍNEAS (Categorías de Productos)
Son las categorías de productos en el catálogo:
- **Mujeres** - Ropa femenina (Blusas, Jeans, Vestidos, Casacas, Pantalones)
- **Hombres** - Ropa masculina (Polos, Jeans, Camisas, Casacas)
- **Niños** - Ropa infantil (Conjuntos)
- **Accesorios** - Bolsos, cinturones, etc.

### Relación
- Un producto de la LÍNEA "Mujeres" se almacena en la TIENDA "Tienda Mujeres"
- Un producto de la LÍNEA "Hombres" se almacena en la TIENDA "Tienda Hombres"
- El stock se gestiona por TIENDA, no por LÍNEA

---

## 📝 Archivos Modificados

### ✅ Frontend (TypeScript/React) - 10 archivos

1. **`components/products/product-search.tsx`**
   - Default warehouse: `'Tienda Mujeres'`

2. **`components/products/product-form-multi-size.tsx`**
   - Default warehouse: `'Tienda Mujeres'`
   - Select options actualizados

3. **`components/inventory/bulk-product-entry.tsx`**
   - Default warehouse: `'Tienda Mujeres'`
   - Select options actualizados

4. **`components/inventory/bulk-product-entry-v2.tsx`**
   - Default warehouse: `'Tienda Mujeres'`
   - Select options actualizados

5. **`components/inventory/movements-table.tsx`**
   - Type `StoreFilter` actualizado
   - Store options actualizados

6. **`components/cash/cash-shift-manager.tsx`**
   - Default store: `'Tienda Hombres'`
   - Available stores actualizados

7. **`components/reports/reports-generator.tsx`**
   - Select options actualizados

8. **`app/(auth)/pos/page.tsx`**
   - Default warehouse: `'Tienda Mujeres'`
   - Select options actualizados

9. **`app/api/products/search/route.ts`**
   - Default warehouse: `'Tienda Mujeres'`
   - Comentarios actualizados

10. **`actions/reports.ts`**
    - Mapeo de store_id actualizado

### ✅ Configuración - 1 archivo nuevo

11. **`config/stores.ts`** (NUEVO)
    - Constantes centralizadas para tiendas
    - Helper functions para validación
    - TypeScript types para type safety

### ✅ Base de Datos - 2 archivos SQL

12. **`supabase/FIX_WAREHOUSE_NAMES.sql`**
    - Script de corrección manual

13. **`supabase/migrations/20260227000002_fix_store_names.sql`**
    - Migración automática
    - Actualiza todas las tablas
    - Incluye verificación de resultados

---

## 🚀 Pasos para Aplicar

### 1️⃣ Ejecutar la Migración SQL

Opción A - Usando Supabase CLI (Recomendado):
```bash
# Si tienes Supabase CLI instalado
supabase db push
```

Opción B - Usando Supabase Dashboard:
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia y pega el contenido de: `supabase/migrations/20260227000002_fix_store_names.sql`
4. Ejecuta el script
5. Verifica los mensajes de NOTICE con los resultados

### 2️⃣ Verificar los Cambios en la Base de Datos

Ejecuta esta query para verificar:

```sql
-- Verificar stock por tienda
SELECT 
  'Stock' as tabla,
  warehouse_id as tienda, 
  COUNT(*) as registros
FROM stock
GROUP BY warehouse_id

UNION ALL

-- Verificar movimientos por tienda
SELECT 
  'Movimientos',
  warehouse_id, 
  COUNT(*)
FROM movements
GROUP BY warehouse_id

UNION ALL

-- Verificar ventas por tienda
SELECT 
  'Ventas',
  store_id, 
  COUNT(*)
FROM sales
GROUP BY store_id

ORDER BY tabla, tienda;
```

**Resultado esperado:**
```
tabla        | tienda          | registros
-------------|-----------------|----------
Movimientos  | Tienda Hombres  | X
Movimientos  | Tienda Mujeres  | Y
Stock        | Tienda Hombres  | X
Stock        | Tienda Mujeres  | Y
Ventas       | Tienda Hombres  | X
Ventas       | Tienda Mujeres  | Y
```

### 3️⃣ Reiniciar la Aplicación

```bash
# Si está corriendo, detener
Ctrl + C

# Limpiar caché de Next.js
rm -rf .next

# Reinstalar dependencias (opcional, solo si hay problemas)
npm install

# Reiniciar
npm run dev
```

---

## ✅ Verificación de Funcionamiento

### Pantalla de Stock
1. Ve a: **Inventario → Stock**
2. Deberías ver exactamente 2 secciones:
   - **Tienda Mujeres** (con sus productos)
   - **Tienda Hombres** (con sus productos)
3. Ya NO deberías ver secciones como "Mujeres" o "TIENDA_MUJERES"

### Ingreso de Productos
1. Ve a: **Inventario → Ingreso Masivo**
2. El selector de tienda debe mostrar:
   - Tienda Mujeres
   - Tienda Hombres

### Punto de Venta (POS)
1. Ve a: **POS**
2. El selector de tienda debe mostrar:
   - Tienda Mujeres
   - Tienda Hombres

### Reportes
1. Ve a: **Reportes**
2. El filtro de tienda debe mostrar:
   - Todas
   - Tienda Hombres
   - Tienda Mujeres

### Caja
1. Ve a: **Caja**
2. Al abrir turno, debe mostrar:
   - Tienda Hombres
   - Tienda Mujeres

---

## 🔍 Solución de Problemas

### Problema: Todavía veo nombres antiguos

**Solución:**
1. Limpia el caché del navegador (Ctrl + Shift + R)
2. Verifica que ejecutaste la migración SQL
3. Reinicia el servidor de desarrollo

### Problema: Error al crear productos

**Solución:**
1. Verifica que el warehouse_id sea exactamente: `'Tienda Mujeres'` o `'Tienda Hombres'`
2. Revisa la consola del navegador para ver el error específico
3. Verifica que la migración SQL se ejecutó correctamente

### Problema: Stock no se muestra correctamente

**Solución:**
```sql
-- Verificar que todos los registros tienen el formato correcto
SELECT DISTINCT warehouse_id FROM stock;

-- Debería retornar solo:
-- Tienda Mujeres
-- Tienda Hombres
```

---

## 📊 Impacto de los Cambios

### Tablas Afectadas:
- ✅ `stock` (warehouse_id)
- ✅ `movements` (warehouse_id)
- ✅ `sales` (store_id)
- ✅ `cash_shifts` (store_id)
- ✅ `users` (stores array)
- ✅ `stores` (code, name) - si existe

### Componentes Actualizados:
- ✅ 10 componentes React/TypeScript
- ✅ 1 archivo de configuración nuevo
- ✅ 2 scripts SQL

### Funcionalidades Mejoradas:
- ✅ Consistencia en toda la aplicación
- ✅ Claridad entre tiendas y líneas de productos
- ✅ Mejor experiencia de usuario
- ✅ Código más mantenible

---

## 📚 Uso del Archivo de Configuración

Para usar las constantes de tiendas en tu código:

```typescript
import { STORES, STORE_OPTIONS, isValidStoreId } from '@/config/stores'

// Usar constantes
const defaultStore = STORES.MUJERES // 'Tienda Mujeres'

// Usar en selects
<select>
  {STORE_OPTIONS.map(store => (
    <option key={store.value} value={store.value}>
      {store.label}
    </option>
  ))}
</select>

// Validar store ID
if (isValidStoreId(storeId)) {
  // storeId es válido
}
```

---

## ✨ Resultado Final

Ahora tu sistema tiene:
- ✅ **2 tiendas físicas** claramente definidas
- ✅ **4 líneas de productos** bien separadas
- ✅ **Nomenclatura consistente** en todo el código
- ✅ **Sin confusión** entre conceptos
- ✅ **Mejor mantenibilidad** del código

---

## 📞 Soporte

Si encuentras algún problema después de aplicar estos cambios:
1. Verifica que ejecutaste la migración SQL
2. Limpia el caché del navegador
3. Reinicia el servidor de desarrollo
4. Revisa los logs de la consola para errores específicos
