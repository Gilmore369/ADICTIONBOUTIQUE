# Resumen: Sistema de Filtro por Tiendas

**Fecha**: 04/03/2026  
**Estado**: ✅ INFRAESTRUCTURA COMPLETADA | ⏳ COMPONENTES PENDIENTES

---

## ✅ Lo que se Implementó

### 1. Base de Datos
- **Tabla `line_stores`**: Relación many-to-many entre líneas y tiendas
- **Funciones SQL**:
  - `get_lines_by_store(store_id)` - Obtiene líneas de una tienda
  - `line_belongs_to_store(line_id, store_id)` - Verifica pertenencia
- **Vista `v_lines_with_stores`**: Muestra líneas con sus tiendas
- **Asignaciones iniciales**:
  - Tienda Hombres: Hombres + Accesorios
  - Tienda Mujeres: Mujeres + Niños + Perfumes + Accesorios

**Archivo**: `supabase/migrations/20260304000000_line_stores_relation.sql`

### 2. Frontend - Infraestructura

#### Contexto Global
**Archivo**: `contexts/store-context.tsx`
```typescript
export type StoreFilter = 'ALL' | 'MUJERES' | 'HOMBRES'

const { selectedStore, storeId, storeName } = useStore()
```
- Maneja el estado global de la tienda seleccionada
- Guarda preferencia en localStorage
- Proporciona el `storeId` para filtrar consultas

#### Selector de Tienda
**Archivo**: `components/layout/store-selector.tsx`
- Dropdown con 3 opciones:
  - 🏬 Todas las Tiendas
  - 👗 Tienda Mujeres
  - 👔 Tienda Hombres
- Ubicado en el header al lado del selector de tema
- Muestra checkmark en la opción seleccionada

#### API Endpoint
**Archivo**: `app/api/stores/route.ts`
- `GET /api/stores?code=MUJERES` - Retorna info de la tienda
- Usado por el contexto para obtener el `store_id`

#### Componentes Actualizados
- `components/shared/header.tsx` - Incluye StoreSelector
- `components/shared/app-shell.tsx` - Envuelve con StoreProvider

### 3. Validación con Playwright
✅ Selector aparece correctamente en el header  
✅ Dropdown se abre y muestra las 3 opciones  
✅ Se puede seleccionar una tienda  
✅ El botón muestra la tienda seleccionada  

**Screenshot**: `store-selector-dropdown.png`

---

## ⏳ Lo que Falta Implementar

### Componentes que Necesitan Filtrar por Tienda

Los siguientes componentes necesitan ser actualizados para usar `useStore()` y filtrar sus datos:

#### 1. Catálogos
- [ ] `components/catalogs/lines-manager.tsx`
- [ ] `components/catalogs/categories-manager.tsx`
- [ ] `components/catalogs/brands-manager.tsx`
- [ ] `components/catalogs/sizes-manager.tsx`
- [ ] `components/catalogs/products-table.tsx`
- [ ] `components/catalogs/visual-catalog.tsx`

#### 2. Inventario
- [ ] `app/(auth)/inventory/bulk-entry/page.tsx`
- [ ] `app/(auth)/inventory/stock/page.tsx`
- [ ] `components/inventory/stock-table.tsx`

#### 3. Ventas y POS
- [ ] `app/(auth)/pos/page.tsx`
- [ ] Componentes de ventas

#### 4. Reportes
- [ ] `components/reports/reports-generator.tsx`
- [ ] Dashboard (filtrar métricas por tienda)

---

## 📋 Pasos para Completar la Implementación

### Paso 1: Ejecutar Migración SQL
```bash
# En Supabase SQL Editor, ejecutar:
supabase/migrations/20260304000000_line_stores_relation.sql
```

**Validar con**:
```sql
SELECT * FROM v_lines_with_stores ORDER BY line_name, store_name;
```

### Paso 2: Actualizar Componente de Líneas (Ejemplo)

**Antes**:
```typescript
// components/catalogs/lines-manager.tsx
const { data: lines } = await supabase
  .from('lines')
  .select('*')
  .eq('active', true)
```

**Después**:
```typescript
'use client'
import { useStore } from '@/contexts/store-context'

export function LinesManager() {
  const { storeId } = useStore()
  
  useEffect(() => {
    const fetchLines = async () => {
      let query = supabase
        .from('lines')
        .select('*')
        .eq('active', true)
      
      // Filtrar por tienda si está seleccionada
      if (storeId) {
        query = supabase
          .from('lines')
          .select(`
            *,
            line_stores!inner(store_id)
          `)
          .eq('active', true)
          .eq('line_stores.store_id', storeId)
      }
      
      const { data } = await query.order('name')
      setLines(data || [])
    }
    
    fetchLines()
  }, [storeId]) // Re-fetch cuando cambia la tienda
  
  // ...resto del componente
}
```

### Paso 3: Actualizar Server Actions

**Archivo**: `actions/catalogs.ts`

```typescript
export async function getLines(storeId?: string) {
  const supabase = await createServerClient()
  
  let query = supabase
    .from('lines')
    .select('*')
    .eq('active', true)
  
  if (storeId) {
    query = supabase
      .from('lines')
      .select(`
        *,
        line_stores!inner(store_id)
      `)
      .eq('active', true)
      .eq('line_stores.store_id', storeId)
  }
  
  const { data, error } = await query.order('name')
  return data || []
}
```

### Paso 4: Validar con Playwright

```typescript
// Test: Filtro de tienda en líneas
await page.goto('http://localhost:3000/catalogs/lines')

// Seleccionar Tienda Hombres
await page.click('[title*="Tienda"]')
await page.click('text=Tienda Hombres')

// Verificar que solo aparecen líneas de Hombres
const lines = await page.locator('table tbody tr td:first-child').allTextContents()
expect(lines).toContain('Hombres')
expect(lines).toContain('Accesorios')
expect(lines).not.toContain('Mujeres')
expect(lines).not.toContain('Niños')
expect(lines).not.toContain('Perfumes')

// Seleccionar Tienda Mujeres
await page.click('[title*="Tienda"]')
await page.click('text=Tienda Mujeres')

// Verificar líneas de Mujeres
const linesM = await page.locator('table tbody tr td:first-child').allTextContents()
expect(linesM).toContain('Mujeres')
expect(linesM).toContain('Niños')
expect(linesM).toContain('Perfumes')
expect(linesM).toContain('Accesorios')
expect(linesM).not.toContain('Hombres')
```

---

## 🎯 Beneficios del Sistema

1. **Separación de Inventarios**: Cada tienda ve solo sus productos
2. **Reportes Específicos**: Métricas por tienda
3. **Gestión Simplificada**: Usuarios de tienda solo ven lo relevante
4. **Escalabilidad**: Fácil agregar más tiendas en el futuro
5. **Flexibilidad**: Admin puede ver todas o filtrar por una

---

## 🔐 Permisos por Rol (Futuro)

```typescript
// Agregar al perfil de usuario
interface UserProfile {
  id: string
  role: 'ADMIN' | 'STORE_MANAGER' | 'CASHIER'
  allowed_stores: string[] // ['MUJERES'] o ['HOMBRES'] o ambas
}

// En StoreSelector, filtrar opciones disponibles
const availableStores = stores.filter(store => 
  user.role === 'ADMIN' || 
  user.allowed_stores.includes(store.value)
)

// Si el usuario solo tiene acceso a una tienda, auto-seleccionarla
useEffect(() => {
  if (user.allowed_stores.length === 1) {
    setSelectedStore(user.allowed_stores[0])
  }
}, [user])
```

---

## 📚 Documentación Creada

1. `SISTEMA_FILTRO_TIENDAS.md` - Guía técnica completa
2. `EJECUTAR_MIGRACION_TIENDAS.md` - Pasos para ejecutar migración
3. `RESUMEN_SISTEMA_TIENDAS.md` - Este documento
4. `supabase/migrations/20260304000000_line_stores_relation.sql` - Migración SQL

---

## ✅ Conclusión

La infraestructura del sistema de filtro por tiendas está **100% completada**:
- ✅ Base de datos con relaciones
- ✅ Contexto global React
- ✅ Selector visual en header
- ✅ API endpoints
- ✅ Validado con Playwright

**Próximo paso**: Actualizar los componentes individuales para que usen el filtro de tienda. Esto se puede hacer de forma incremental, componente por componente.

**Prioridad sugerida**:
1. Líneas y Categorías (catálogos básicos)
2. Ingreso Masivo (inventario)
3. POS (ventas)
4. Reportes y Dashboard
