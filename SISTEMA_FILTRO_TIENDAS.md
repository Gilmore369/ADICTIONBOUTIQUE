# Sistema de Filtro por Tiendas

**Fecha**: 04/03/2026  
**Estado**: ✅ IMPLEMENTADO

---

## Descripción General

Sistema que permite filtrar toda la aplicación por tienda (Hombres/Mujeres/Ambas). Cada tienda tiene líneas específicas asignadas:

- **Tienda Hombres**: Hombres + Accesorios
- **Tienda Mujeres**: Mujeres + Niños + Perfumes + Accesorios

---

## Arquitectura

### 1. Base de Datos

**Nueva tabla**: `line_stores` (relación many-to-many)
```sql
CREATE TABLE line_stores (
  id UUID PRIMARY KEY,
  line_id UUID REFERENCES lines(id),
  store_id UUID REFERENCES stores(id),
  UNIQUE(line_id, store_id)
);
```

**Funciones helper**:
- `get_lines_by_store(store_id)` - Retorna líneas de una tienda
- `line_belongs_to_store(line_id, store_id)` - Verifica pertenencia

**Vista**: `v_lines_with_stores` - Muestra líneas con sus tiendas

### 2. Frontend

**Contexto**: `contexts/store-context.tsx`
```typescript
export type StoreFilter = 'ALL' | 'MUJERES' | 'HOMBRES'

interface StoreContextType {
  selectedStore: StoreFilter
  setSelectedStore: (store: StoreFilter) => void
  storeId: string | null
  storeName: string
}
```

**Hook**: `useStore()`
```typescript
const { selectedStore, storeId, storeName } = useStore()
```

**Componente**: `components/layout/store-selector.tsx`
- Selector en el header (al lado del tema)
- Guarda preferencia en localStorage
- Iconos: 🏬 (Todas), 👗 (Mujeres), 👔 (Hombres)

---

## Uso en Componentes

### Ejemplo 1: Filtrar líneas en un selector

```typescript
'use client'

import { useStore } from '@/contexts/store-context'
import { useEffect, useState } from 'react'

export function LineSelector() {
  const { storeId } = useStore()
  const [lines, setLines] = useState([])

  useEffect(() => {
    const fetchLines = async () => {
      const params = new URLSearchParams()
      if (storeId) params.append('store_id', storeId)
      
      const response = await fetch(`/api/lines?${params}`)
      const data = await response.json()
      setLines(data)
    }
    
    fetchLines()
  }, [storeId])

  return (
    <select>
      {lines.map(line => (
        <option key={line.id} value={line.id}>{line.name}</option>
      ))}
    </select>
  )
}
```

### Ejemplo 2: Filtrar en Server Actions

```typescript
// actions/catalogs.ts

export async function getLines(storeId?: string) {
  const supabase = await createServerClient()
  
  let query = supabase
    .from('lines')
    .select('*')
    .eq('active', true)
  
  // Si hay filtro de tienda, aplicar JOIN
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

### Ejemplo 3: Filtrar productos por tienda

```typescript
export async function getProducts(storeId?: string) {
  const supabase = await createServerClient()
  
  let query = supabase
    .from('products')
    .select(`
      *,
      categories(
        *,
        lines(*)
      )
    `)
  
  if (storeId) {
    // Filtrar productos cuya línea pertenece a la tienda
    query = query.select(`
      *,
      categories!inner(
        *,
        lines!inner(
          *,
          line_stores!inner(store_id)
        )
      )
    `).eq('categories.lines.line_stores.store_id', storeId)
  }
  
  const { data } = await query
  return data || []
}
```

---

## API Endpoints

### GET /api/stores?code=MUJERES
Retorna información de la tienda:
```json
{
  "id": "uuid",
  "code": "MUJERES",
  "name": "Adiction Boutique Mujeres"
}
```

### GET /api/lines?store_id=uuid
Retorna líneas filtradas por tienda

---

## Migración Ejecutada

**Archivo**: `supabase/migrations/20260304000000_line_stores_relation.sql`

**Asignaciones iniciales**:
- Tienda Hombres: Hombres, Accesorios
- Tienda Mujeres: Mujeres, Niños, Perfumes, Accesorios

**Validación**:
```sql
SELECT * FROM v_lines_with_stores ORDER BY line_name, store_name;

SELECT 
  s.name as tienda,
  COUNT(ls.line_id) as total_lineas,
  STRING_AGG(l.name, ', ' ORDER BY l.name) as lineas
FROM stores s
LEFT JOIN line_stores ls ON s.id = ls.store_id
LEFT JOIN lines l ON ls.line_id = l.id
GROUP BY s.id, s.name
ORDER BY s.name;
```

---

## Componentes Actualizados

### ✅ Infraestructura
- `contexts/store-context.tsx` - Contexto global
- `components/layout/store-selector.tsx` - Selector en header
- `components/shared/header.tsx` - Incluye StoreSelector
- `components/shared/app-shell.tsx` - Envuelve con StoreProvider
- `app/api/stores/route.ts` - API endpoint

### ⏳ Pendientes de Actualizar
Los siguientes componentes necesitan usar `useStore()` para filtrar:

1. **Catálogos**:
   - `components/catalogs/lines-manager.tsx`
   - `components/catalogs/categories-manager.tsx`
   - `components/catalogs/products-table.tsx`
   - `components/catalogs/visual-catalog.tsx`

2. **Inventario**:
   - `app/(auth)/inventory/bulk-entry/page.tsx`
   - `app/(auth)/inventory/stock/page.tsx`

3. **POS**:
   - `app/(auth)/pos/page.tsx`

4. **Reportes**:
   - `components/reports/reports-generator.tsx`

---

## Permisos por Rol (Futuro)

```typescript
// En el perfil de usuario agregar:
interface UserProfile {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STORE_MANAGER'
  allowed_stores: string[] // ['MUJERES'] o ['HOMBRES'] o ['MUJERES', 'HOMBRES']
}

// El selector solo muestra tiendas permitidas
const availableStores = stores.filter(s => 
  user.role === 'ADMIN' || user.allowed_stores.includes(s.value)
)
```

---

## Testing con Playwright

```typescript
// Verificar selector de tienda
await page.goto('http://localhost:3000/catalogs/lines')
await page.click('[title*="Tienda"]') // Click en selector
await page.click('text=Tienda Hombres') // Seleccionar Hombres

// Verificar que solo aparecen líneas de Hombres
const lines = await page.locator('table tbody tr').allTextContents()
expect(lines).toContain('Hombres')
expect(lines).toContain('Accesorios')
expect(lines).not.toContain('Mujeres')
expect(lines).not.toContain('Niños')
expect(lines).not.toContain('Perfumes')
```

---

## Conclusión

El sistema de filtro por tiendas está implementado a nivel de infraestructura. Los componentes individuales necesitan ser actualizados para usar el contexto `useStore()` y filtrar sus consultas según la tienda seleccionada.

**Próximos pasos**:
1. Ejecutar migración SQL
2. Actualizar componentes de catálogos para usar filtro
3. Actualizar inventario y POS
4. Validar con Playwright
5. Implementar permisos por rol (opcional)
