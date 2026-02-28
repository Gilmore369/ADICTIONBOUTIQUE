# Solución: Gestión de Imágenes de Productos

## Problema Actual

Las imágenes están en Supabase Storage pero no se muestran en el catálogo visual porque:

1. Los `base_code` en `product_images` no coinciden con los productos
2. Las imágenes no están vinculadas correctamente con los colores
3. Falta un flujo claro para subir imágenes al crear productos

## Solución Paso a Paso

### 1. Diagnosticar el Estado Actual

Ejecuta en Supabase SQL Editor:

```sql
-- Ver archivo: supabase/DIAGNOSTICO_IMAGENES.sql
```

Esto te mostrará:
- Qué imágenes tienes en `product_images`
- Qué productos tienes y sus códigos base
- Qué base_codes tienen imágenes vs productos

### 2. Corregir Vínculos Existentes

Ejecuta en Supabase SQL Editor:

```sql
-- Ver archivo: supabase/FIX_PRODUCT_IMAGES.sql
```

Esto:
- Copiará `image_url` de productos a `product_images`
- Vinculará imágenes con productos por `base_code`
- Mostrará qué productos tienen imágenes

### 3. Estructura Correcta

#### Tabla `products`
```
barcode: "CHA-L"  (Código único por variante)
name: "Chaleco Army - L"
color: "Negro"
size: "L"
image_url: URL opcional (se usa si no hay en product_images)
```

#### Tabla `product_images`
```
base_code: "CHA"  (Sin la talla, agrupa todas las variantes)
color: "Negro" (o NULL para imagen general del modelo)
is_primary: true (una por base_code+color)
public_url: "https://...supabase.co/storage/v1/object/public/..."
```

### 4. Flujo para Agregar Imágenes

#### Opción A: Al Crear Productos (Ingreso Masivo)

1. En el formulario de ingreso masivo, hay un campo "Imagen (opcional)"
2. Pega la URL de la imagen o súbela
3. La imagen se asocia al modelo base y se comparte entre todas las tallas

#### Opción B: Desde el Catálogo Visual

1. Abre el catálogo visual (`/catalogs/visual`)
2. Haz clic en cualquier producto
3. En el modal de detalle, haz clic en "Subir imagen"
4. Selecciona la imagen y súbela
5. Marca como principal si es necesario

### 5. Convención de Nombres

Para que las imágenes se vinculen correctamente:

**Productos:**
- Barcode: `{BASE_CODE}-{TALLA}` → Ejemplo: `CHA-L`, `CHA-M`, `CHA-XL`
- Name: `{NOMBRE_BASE} - {TALLA}` → Ejemplo: `Chaleco Army - L`

**Imágenes:**
- base_code: `{BASE_CODE}` → Ejemplo: `CHA` (sin la talla)
- color: `{COLOR}` o `NULL` → Ejemplo: `Negro` o `NULL` (para imagen general)

### 6. Subir Imágenes Manualmente

Si tienes imágenes en tu computadora:

1. Ve a Supabase Dashboard → Storage → `product-images`
2. Sube las imágenes con nombres descriptivos: `CHA-negro.jpg`, `CHA-azul.jpg`
3. Copia la URL pública de cada imagen
4. Ejecuta en SQL:

```sql
INSERT INTO product_images (base_code, color, is_primary, public_url, storage_path)
VALUES 
  ('CHA', 'Negro', true, 'https://...url-de-la-imagen...', 'CHA-negro.jpg'),
  ('CHA', 'Azul', false, 'https://...url-de-la-imagen...', 'CHA-azul.jpg');
```

### 7. Verificar que Funciona

1. Ejecuta: `SELECT * FROM product_images ORDER BY base_code;`
2. Verifica que `base_code` coincide con tus productos
3. Recarga el catálogo visual
4. Las imágenes deberían aparecer

## Mejoras Implementadas

✅ Sidebar colapsable con botón
✅ Carrito colapsable con botón  
✅ Grid responsive que se ajusta automáticamente
✅ Soporte para imágenes por color
✅ Campo de imagen en ingreso masivo
✅ Modal de detalle con galería de imágenes

## Próximos Pasos

1. Ejecuta `DIAGNOSTICO_IMAGENES.sql` para ver el estado actual
2. Ejecuta `FIX_PRODUCT_IMAGES.sql` para corregir vínculos
3. Sube imágenes para tus productos principales
4. Verifica en el catálogo visual

## Notas Importantes

- El `base_code` debe ser el código SIN la talla (ej: `CHA` no `CHA-L`)
- Puedes tener múltiples imágenes por modelo (una por color)
- Solo una imagen puede ser `is_primary = true` por `base_code + color`
- Si no hay imagen en `product_images`, se usa `products.image_url` como fallback
