# ✅ Solución: Filtro por Tienda en Catálogo Visual

## 🐛 Problema Reportado

Cuando seleccionas "Hombres" o "Mujeres" en el catálogo visual, no se filtra por tienda. El componente mostraba TODAS las líneas sin considerar la tienda del usuario.

## 🔍 Causa Raíz

El componente `VisualCatalog` estaba cargando:
1. ❌ Todas las líneas sin filtrar por `line_stores`
2. ❌ Todos los productos sin filtrar por líneas disponibles en la tienda

```typescript
// ANTES (incorrecto):
const [linesRes, catsRes, brandsRes] = await Promise.all([
  supabase.from('lines').select('id, name').eq('active', true).order('name'),
  // ... cargaba TODAS las líneas
])
```

## ✅ Solución Implementada

### Cambios en `components/catalogs/visual-catalog.tsx`

#### 1. Obtener tienda del usuario
```typescript
// 1. Get user's store/warehouse
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  setLoading(false)
  return
}

const { data: profile } = await supabase
  .from('profiles')
  .select('warehouse_id')
  .eq('id', user.id)
  .single()

const userWarehouseId = profile?.warehouse_id
```

#### 2. Obtener líneas disponibles para esa tienda
```typescript
// 2. Get lines available for this store (via line_stores)
let availableLineIds: string[] = []
if (userWarehouseId) {
  const { data: lineStores } = await supabase
    .from('line_stores')
    .select('line_id')
    .eq('warehouse_id', userWarehouseId)
  
  availableLineIds = (lineStores || []).map(ls => ls.line_id)
}
```

#### 3. Filtrar líneas por tienda
```typescript
// 3. Load lines filtered by store
const linesQuery = supabase
  .from('lines')
  .select('id, name')
  .eq('active', true)
  .order('name')

if (availableLineIds.length > 0) {
  linesQuery.in('id', availableLineIds)
}

const [linesRes, catsRes, brandsRes] = await Promise.all([
  linesQuery,
  // ...
])
```

#### 4. Filtrar productos por líneas disponibles
```typescript
// 4. Load products filtered by available lines
const productsQuery = supabase
  .from('products')
  .select(`...`)
  .eq('active', true)
  .order('base_code', { nullsFirst: false })
  .limit(2000)

// Filter by available lines if user has a store
if (availableLineIds.length > 0) {
  productsQuery.in('line_id', availableLineIds)
}

const { data: products, error: productsError } = await productsQuery
```

## 🔧 Verificación

### Script 1: Verificar configuración actual
Ejecuta `supabase/VERIFICAR_LINE_STORES_CATALOGO.sql` para ver:
- Todas las tiendas activas
- Todas las líneas activas
- Relaciones `line_stores` actuales
- Qué líneas ve cada tienda
- Productos por línea y tienda
- Líneas sin relación con tiendas
- Productos sin línea asignada

### Script 2: Asociar todas las líneas a todas las tiendas
Si quieres que TODAS las tiendas vean TODAS las líneas, ejecuta:
```bash
supabase/FIX_LINE_STORES_TODAS_TIENDAS.sql
```

Este script:
1. Muestra estado actual
2. Inserta relaciones faltantes (CROSS JOIN)
3. Verifica resultado
4. Cuenta total de relaciones

## 📊 Flujo Corregido

```
Usuario abre Catálogo Visual
         ↓
Sistema obtiene warehouse_id del usuario
         ↓
Consulta line_stores para ese warehouse_id
         ↓
Obtiene lista de line_ids disponibles
         ↓
Filtra líneas: WHERE id IN (line_ids)
         ↓
Filtra productos: WHERE line_id IN (line_ids)
         ↓
Usuario solo ve líneas y productos de su tienda
```

## 🎯 Ejemplo

### Antes (incorrecto):
```
Usuario en "Tienda Centro":
- Ve líneas: Hombres, Mujeres, Niños, Accesorios, Perfumes
- Ve productos de TODAS las líneas
```

### Después (correcto):
```
Usuario en "Tienda Centro":
- line_stores tiene: Hombres, Mujeres, Accesorios
- Ve líneas: Hombres, Mujeres, Accesorios
- Ve productos SOLO de esas 3 líneas
```

## 🧪 Pruebas

### Prueba 1: Usuario con tienda específica
1. Login como usuario de "Tienda Centro"
2. Ir a `/catalogs/visual`
3. Abrir selector de "Línea"
4. ✅ Verificar que solo muestra líneas asociadas a "Tienda Centro" en `line_stores`

### Prueba 2: Productos filtrados
1. Seleccionar línea "Hombres"
2. ✅ Verificar que solo muestra productos con `line_id` = "Hombres"
3. ✅ Verificar que NO muestra productos de otras líneas

### Prueba 3: Sin relaciones line_stores
1. Si una tienda NO tiene relaciones en `line_stores`
2. ✅ No muestra ninguna línea
3. ✅ No muestra ningún producto

## 📝 Configuración Recomendada

### Opción A: Todas las tiendas ven todas las líneas
```sql
-- Ejecutar FIX_LINE_STORES_TODAS_TIENDAS.sql
-- Resultado: Todas las tiendas ven todo el inventario
```

### Opción B: Cada tienda ve líneas específicas
```sql
-- Configurar manualmente en line_stores
INSERT INTO line_stores (warehouse_id, line_id) VALUES
  ('tienda-centro-id', 'hombres-id'),
  ('tienda-centro-id', 'mujeres-id'),
  ('tienda-norte-id', 'ninos-id'),
  ('tienda-norte-id', 'accesorios-id');
```

### Opción C: Líneas por tipo de tienda
```sql
-- Tiendas físicas ven todo
INSERT INTO line_stores (warehouse_id, line_id)
SELECT w.warehouse_id, l.id
FROM warehouses w
CROSS JOIN lines l
WHERE w.type = 'TIENDA' AND w.active = true AND l.active = true;

-- Almacenes solo ven líneas específicas
INSERT INTO line_stores (warehouse_id, line_id)
SELECT w.warehouse_id, l.id
FROM warehouses w
CROSS JOIN lines l
WHERE w.type = 'ALMACEN' 
  AND w.active = true 
  AND l.active = true
  AND l.name IN ('Hombres', 'Mujeres');
```

## 🚀 Despliegue

### Archivos Modificados:
- ✅ `components/catalogs/visual-catalog.tsx` - Filtrado por tienda

### Archivos Creados:
- ✅ `supabase/VERIFICAR_LINE_STORES_CATALOGO.sql` - Diagnóstico
- ✅ `supabase/FIX_LINE_STORES_TODAS_TIENDAS.sql` - Configuración automática
- ✅ `SOLUCION_FILTRO_CATALOGO_VISUAL.md` - Este documento

### Pasos:
1. ✅ Código actualizado en `visual-catalog.tsx`
2. ⏳ Ejecutar `VERIFICAR_LINE_STORES_CATALOGO.sql` para ver estado actual
3. ⏳ Decidir configuración (Opción A, B o C)
4. ⏳ Ejecutar script de configuración si es necesario
5. ⏳ Probar en navegador

## ✅ Resultado Esperado

Después de aplicar la solución:
- ✅ Catálogo visual filtra líneas por tienda del usuario
- ✅ Solo muestra productos de líneas disponibles en esa tienda
- ✅ Selector de "Línea" solo muestra opciones válidas
- ✅ Mejora la experiencia del usuario (no ve productos que no puede vender)
- ✅ Mejora el rendimiento (carga menos datos)

## 🔄 Compatibilidad

Esta solución es compatible con:
- ✅ Ingreso masivo de productos (ya usa `line_stores`)
- ✅ POS (puede usar el mismo filtro si es necesario)
- ✅ Reportes (puede filtrar por tienda)
- ✅ Gestión de catálogos (administradores ven todo)

## 📞 Soporte

Si después de aplicar la solución sigues viendo todas las líneas:
1. Verifica que el usuario tenga `warehouse_id` en su perfil
2. Verifica que existan relaciones en `line_stores` para ese warehouse
3. Revisa la consola del navegador para errores
4. Ejecuta `VERIFICAR_LINE_STORES_CATALOGO.sql` para diagnóstico
