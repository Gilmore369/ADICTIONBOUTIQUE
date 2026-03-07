# Actualización de Componentes con Filtro de Tiendas

**Fecha**: 04/03/2026  
**Estado**: ✅ EN PROGRESO

---

## Componentes Actualizados

### ✅ 1. Sizes Manager
**Archivo**: `components/catalogs/sizes-manager.tsx`

**Cambios**:
- Importado `useStore` hook y `useEffect`
- Agregado estado local para `lines`, `categories`, y `sizes`
- Implementado `useEffect` que filtra por tienda:
  - Cuando `selectedStore === 'ALL'`: Muestra todos los datos
  - Cuando hay `storeId`: 
    1. Obtiene líneas filtradas del API
    2. Filtra categorías que pertenecen a esas líneas
    3. Filtra tallas que pertenecen a esas categorías

**Lógica de Filtrado**:
```typescript
// 1. Filtrar líneas por tienda
const linesRes = await fetch(`/api/catalogs/lines?store_id=${storeId}`)
const filteredLines = await linesRes.json()

// 2. Filtrar categorías por líneas
const lineIds = filteredLines.map(l => l.id)
const filteredCategories = initialCategories.filter(cat => 
  cat.line_id && lineIds.includes(cat.line_id)
)

// 3. Filtrar tallas por categorías
const categoryIds = filteredCategories.map(c => c.id)
const filteredSizes = initialSizes.filter(size => 
  categoryIds.includes(size.category_id)
)
```

**Resultado**:
- Tienda Hombres: Solo tallas de categorías de Hombres y Accesorios
- Tienda Mujeres: Solo tallas de categorías de Mujeres, Niños, Perfumes y Accesorios
- Todas las Tiendas: Todas las tallas

---

### ⚠️ 2. Brands Manager
**Archivo**: `components/catalogs/brands-manager.tsx`

**Decisión**: NO se filtra por tienda

**Razón**: 
- Las marcas NO tienen relación directa con líneas en el modelo de datos
- Las marcas están relacionadas con proveedores (tabla `supplier_brands`)
- Una marca puede tener productos en múltiples líneas/tiendas
- Ejemplo: "Nike" puede tener productos en Hombres, Mujeres, Niños

**Alternativa Futura**:
Si se requiere filtrar marcas por tienda, se necesitaría:
1. Crear relación `brand_lines` o `brand_stores`
2. O filtrar marcas que tienen productos en las líneas de la tienda seleccionada
3. Esto requeriría cambios en el modelo de datos

**Estado Actual**: Sin cambios, muestra todas las marcas

---

## Próximos Componentes a Actualizar

### 🔄 3. Products Table
**Archivo**: `components/catalogs/products-table.tsx`

**Plan**:
- Filtrar productos por `line_id` usando las líneas de la tienda
- Productos tienen relación directa con líneas

### 🔄 4. Visual Catalog
**Archivo**: `components/catalogs/visual-catalog.tsx`

**Plan**:
- Similar a products-table
- Filtrar productos mostrados en el catálogo visual

### 🔄 5. Stock Page
**Archivo**: `app/(auth)/inventory/stock/page.tsx`

**Plan**:
- Filtrar stock por productos de las líneas de la tienda

### 🔄 6. POS
**Archivo**: `app/(auth)/pos/page.tsx`

**Plan**:
- Mostrar solo productos de la tienda seleccionada en el punto de venta

### 🔄 7. Reports Generator
**Archivo**: `components/reports/reports-generator.tsx`

**Plan**:
- Agregar filtro de tienda a los reportes
- Métricas específicas por tienda

---

## Patrón de Implementación

Para cada componente que necesita filtro de tienda:

```typescript
'use client'

import { useStore } from '@/contexts/store-context'
import { useState, useEffect } from 'react'

export function MyComponent({ initialData }: Props) {
  const { storeId, selectedStore } = useStore()
  const [data, setData] = useState(initialData)

  useEffect(() => {
    const filterByStore = async () => {
      if (selectedStore === 'ALL') {
        setData(initialData)
      } else if (storeId) {
        try {
          // Opción 1: Fetch desde API con filtro
          const res = await fetch(`/api/my-endpoint?store_id=${storeId}`)
          const filtered = await res.json()
          setData(filtered)
          
          // Opción 2: Filtrar localmente
          // const filtered = initialData.filter(item => ...)
          // setData(filtered)
        } catch (err) {
          console.error('Error filtering:', err)
        }
      }
    }

    filterByStore()
  }, [storeId, selectedStore, initialData])

  // ... resto del componente
}
```

---

## Validación Pendiente

Una vez actualizados todos los componentes, validar con Playwright:

1. Navegar a cada página
2. Cambiar selector de tienda
3. Verificar que los datos se filtran correctamente
4. Tomar screenshots de evidencia

---

## Notas Técnicas

### Relaciones de Datos por Tienda

```
Stores
  ↓ (line_stores)
Lines
  ↓ (categories.line_id)
Categories
  ↓ (sizes.category_id)
Sizes

Lines
  ↓ (products.line_id)
Products
  ↓ (stock.product_id)
Stock
```

### Componentes que NO necesitan filtro

- Suppliers (proveedores son compartidos)
- Brands (marcas son compartidas, a menos que se agregue relación)
- Clients (clientes son globales)
- Users (usuarios son globales)

