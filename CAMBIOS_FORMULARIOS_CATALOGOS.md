# Cambios Realizados en Formularios de Catálogos

## Problema Identificado

Los formularios de catálogos NO tenían un campo para controlar el estado `active` de los registros. Esto causaba que:

1. **Línea "Perfumes"** no aparecía en los selectores porque `active = false`
2. No había forma de activar/desactivar registros desde la interfaz
3. Los usuarios no podían controlar qué registros aparecen en los selectores

## Solución Implementada

Se agregó un **checkbox "Activo"** a todos los formularios de edición de catálogos:

### ✅ Archivos Modificados

1. **`components/catalogs/line-form.tsx`**
   - Agregado prop `isEditing?: boolean`
   - Agregado campo `active?: boolean` en defaultValues
   - Agregado checkbox "Activo" que solo aparece en modo edición
   - Importado componente `Checkbox`

2. **`components/catalogs/category-form.tsx`**
   - Agregado prop `isEditing?: boolean`
   - Agregado campo `active?: boolean` en defaultValues
   - Agregado checkbox "Activo" que solo aparece en modo edición
   - Importado componente `Checkbox`

3. **`components/catalogs/brand-form.tsx`**
   - Agregado prop `isEditing?: boolean`
   - Agregado campo `active?: boolean` en defaultValues
   - Agregado checkbox "Activo" que solo aparece en modo edición

4. **`components/catalogs/size-form.tsx`**
   - Agregado prop `isEditing?: boolean`
   - Agregado campo `active?: boolean` en defaultValues
   - Agregado checkbox "Activo" que solo aparece en modo edición
   - Importado componente `Checkbox`

5. **`components/catalogs/supplier-form.tsx`**
   - Agregado prop `isEditing?: boolean`
   - Agregado campo `active?: boolean` en defaultValues
   - Agregado checkbox "Activo" que solo aparece en modo edición
   - Importado componente `Checkbox`

### ✅ Managers Actualizados

Se actualizaron todos los managers para pasar el prop `isEditing`:

1. **`components/catalogs/lines-manager.tsx`**
   ```tsx
   <LineForm 
     defaultValues={selectedLine || undefined} 
     isEditing={!!selectedLine}
   />
   ```

2. **`components/catalogs/categories-manager.tsx`**
   ```tsx
   <CategoryForm 
     lines={lines} 
     defaultValues={selectedCategory || undefined} 
     isEditing={!!selectedCategory}
   />
   ```

3. **`components/catalogs/brands-manager.tsx`**
   ```tsx
   <BrandForm 
     suppliers={suppliers} 
     defaultValues={selectedBrand || undefined} 
     isEditing={!!selectedBrand}
   />
   ```

4. **`components/catalogs/sizes-manager.tsx`**
   ```tsx
   <SizeForm 
     categories={categories} 
     defaultValues={selectedSize || undefined} 
     isEditing={!!selectedSize}
   />
   ```

5. **`components/catalogs/suppliers-manager.tsx`**
   ```tsx
   <SupplierForm 
     defaultValues={selectedSupplier || undefined} 
     isEditing={!!selectedSupplier}
   />
   ```

## Comportamiento del Checkbox

- **Solo aparece en modo edición** (cuando `isEditing = true`)
- **Valor por defecto**: `checked` si `active !== false` (asume true si no está definido)
- **Label**: "Activo (visible en selectores)"
- **Ubicación**: Al final del formulario, después de todos los demás campos

## Cómo Usar

### Para Activar la Línea "Perfumes":

1. Ir a `/catalogs/lines`
2. Hacer clic en "Editar" en la fila de "Perfumes"
3. Marcar el checkbox "Activo (visible en selectores)"
4. Guardar

### Para Desactivar Cualquier Registro:

1. Ir al módulo correspondiente (Líneas, Categorías, Marcas, Tallas, Proveedores)
2. Hacer clic en "Editar" en el registro deseado
3. Desmarcar el checkbox "Activo"
4. Guardar

## Validación de Acciones del Servidor

Necesitas verificar que las acciones en `actions/catalogs.ts` manejen correctamente el campo `active` al actualizar:

```typescript
// Ejemplo para updateLine
const active = formData.get('active') === 'on' // Checkbox envía 'on' cuando está marcado

await supabase
  .from('lines')
  .update({
    name,
    description,
    active, // Agregar este campo
    updated_at: new Date().toISOString()
  })
  .eq('id', id)
```

## Script SQL para Perfumes

Se creó el archivo `supabase/FIX_PERFUMES_LINE.sql` que:

1. ✅ Activa la línea de Perfumes
2. ✅ Crea 3 categorías:
   - Fragancias Hombre
   - Fragancias Mujer
   - Fragancias Unisex
3. ✅ Crea tallas apropiadas (30ml, 50ml, 100ml, 150ml, 200ml)

## Próximos Pasos

1. **Ejecutar el script SQL** `supabase/FIX_PERFUMES_LINE.sql` en Supabase
2. **Verificar las acciones** en `actions/catalogs.ts` para asegurar que manejen el campo `active`
3. **Probar en la interfaz**:
   - Editar la línea "Perfumes" y verificar que el checkbox aparece
   - Activar "Perfumes" y verificar que aparece en los selectores
   - Crear categorías y tallas para Perfumes

## Beneficios

- ✅ Control total sobre qué registros aparecen en selectores
- ✅ No es necesario eliminar registros, solo desactivarlos
- ✅ Interfaz consistente en todos los módulos de catálogos
- ✅ Soluciona el problema de "Perfumes" no visible
- ✅ Permite mantener histórico de registros desactivados
