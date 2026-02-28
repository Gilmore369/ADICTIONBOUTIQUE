# Configurar Imágenes de Productos

## Problema Actual
- Tienes imágenes en el storage de Supabase (`product-images` bucket)
- Tienes registros en la tabla `product_images`
- Pero las imágenes NO se muestran en el catálogo visual

## Solución en 3 Pasos

### Paso 1: Configurar el Bucket como Público

1. Ve a **Supabase Dashboard** → **Storage** → **product-images**
2. Click en el ícono de configuración (⚙️) del bucket
3. Marca la opción **"Public bucket"** como `true`
4. Guarda los cambios

### Paso 2: Aplicar Políticas de Acceso

Ejecuta este script en **Supabase SQL Editor**:

```sql
-- Archivo: supabase/STORAGE_POLICIES.sql
```

Esto creará las políticas necesarias para:
- ✅ Lectura pública de imágenes
- ✅ Subida de imágenes por usuarios autenticados
- ✅ Actualización y eliminación por usuarios autenticados

### Paso 3: Sincronizar Imágenes con Productos

Ejecuta este script en **Supabase SQL Editor**:

```sql
-- Archivo: supabase/FIX_PRODUCT_IMAGES.sql
```

Esto:
- ✅ Verifica que la tabla `product_images` existe
- ✅ Sincroniza `products.image_url` con las imágenes primarias
- ✅ Muestra un reporte del estado actual

## Verificación

Después de ejecutar los scripts, verifica:

1. **En Supabase Storage**:
   - El bucket `product-images` debe estar marcado como "Public"
   - Las URLs deben ser accesibles sin autenticación

2. **En SQL Editor**, ejecuta:
   ```sql
   SELECT 
     base_code,
     color,
     is_primary,
     public_url
   FROM product_images
   WHERE is_primary = true
   LIMIT 5;
   ```

3. **Prueba una URL** directamente en el navegador:
   - Copia una `public_url` de la consulta anterior
   - Pégala en el navegador
   - Deberías ver la imagen

## Cómo Subir Imágenes

### Opción 1: Desde el Catálogo Visual
1. Ve a **Catálogos** → **Catálogo Visual**
2. Click en cualquier producto
3. En el modal de detalle, usa el botón **"Subir Imagen"**
4. Marca la imagen como **"Principal"** si es la primera

### Opción 2: Desde Ingreso Masivo
1. Ve a **Inventario** → **Ingreso Masivo**
2. Al crear un modelo, usa el campo **"Imagen (opcional)"**
3. Pega la URL de la imagen o súbela

### Opción 3: Directamente en Supabase Storage
1. Ve a **Storage** → **product-images**
2. Sube las imágenes con la estructura:
   - `{base_code}/{color}/{filename}.jpg`
   - Ejemplo: `CHA/negro/frente.jpg`
3. Luego inserta el registro en `product_images`:
   ```sql
   INSERT INTO product_images (base_code, color, is_primary, public_url, storage_path)
   VALUES (
     'CHA',
     'negro',
     true,
     'https://tu-proyecto.supabase.co/storage/v1/object/public/product-images/CHA/negro/frente.jpg',
     'CHA/negro/frente.jpg'
   );
   ```

## Estructura Recomendada

### Para productos con un solo color:
```
product_images/
  CHA/
    frente.jpg       → is_primary: true, color: NULL
    lateral.jpg      → is_primary: false, color: NULL
```

### Para productos con múltiples colores:
```
product_images/
  CHA/
    negro/
      frente.jpg     → is_primary: true, color: 'negro'
      lateral.jpg    → is_primary: false, color: 'negro'
    azul/
      frente.jpg     → is_primary: false, color: 'azul'
      lateral.jpg    → is_primary: false, color: 'azul'
```

## Troubleshooting

### Las imágenes siguen sin mostrarse
1. Verifica que el bucket sea público
2. Verifica que las URLs sean correctas
3. Abre la consola del navegador (F12) y busca errores 403 o 404
4. Ejecuta: `SELECT * FROM product_images LIMIT 5;` y verifica las URLs

### Error 403 (Forbidden)
- El bucket no es público
- Las políticas de storage no están configuradas
- Ejecuta `STORAGE_POLICIES.sql`

### Error 404 (Not Found)
- La ruta del archivo es incorrecta
- El archivo no existe en el storage
- Verifica en **Storage** → **product-images**

### Las imágenes se suben pero no aparecen
- Falta el registro en `product_images`
- Ejecuta `FIX_PRODUCT_IMAGES.sql` para sincronizar
- Verifica que `is_primary = true` para al menos una imagen por modelo
