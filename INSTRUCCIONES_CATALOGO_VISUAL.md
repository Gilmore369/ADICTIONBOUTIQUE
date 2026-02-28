# Instrucciones para Catálogo Visual

## Cambios Realizados

### 1. Sidebar Colapsable (Izquierda)
- ✅ Agregado estado `sidebarOpen` para controlar visibilidad
- ✅ Botón con icono de chevron que cambia dirección según estado
- ✅ Transición suave de ancho (w-64 → w-0)
- ✅ Overflow hidden para ocultar contenido

### 2. Carrito Colapsable (Derecha)
- ✅ Ya existía como drawer con backdrop
- ✅ Botón toggle que muestra "Carrito" u "Ocultar"
- ✅ Posicionado como fixed a la derecha
- ✅ Transición suave con translate-x

### 3. Grid Responsivo
- ✅ Grid ajusta columnas según paneles abiertos:
  - Ambos abiertos: 2-3-4 columnas
  - Uno abierto: 2-3-4-5 columnas
  - Ambos cerrados: 2-3-5-6-7 columnas

### 4. Imágenes de Productos
- ✅ Consulta a tabla `product_images` para imágenes primarias
- ✅ Fallback a `products.image_url` si no hay en product_images
- ✅ Console.log agregado para debug
- ✅ Manejo de errores mejorado

## PASOS PARA VERIFICAR

### Paso 1: Reiniciar el Servidor de Desarrollo
```bash
# Detener el servidor actual (Ctrl+C)
# Luego ejecutar:
npm run dev
```

### Paso 2: Limpiar Caché del Navegador
1. Abrir DevTools (F12)
2. Click derecho en el botón de recargar
3. Seleccionar "Vaciar caché y recargar de forma forzada"

O simplemente:
- Ctrl + Shift + R (Windows/Linux)
- Cmd + Shift + R (Mac)

### Paso 3: Verificar Imágenes en Base de Datos
Ejecutar en Supabase SQL Editor:
```sql
-- Ver el script DEBUG_VISUAL_CATALOG.sql
```

### Paso 4: Verificar en Consola del Navegador
1. Abrir DevTools (F12)
2. Ir a la pestaña Console
3. Buscar mensajes que empiecen con `[VisualCatalog]`
4. Verificar:
   - ¿Cuántas imágenes se cargaron?
   - ¿Qué URLs tienen?
   - ¿Hay errores?

## PROBLEMAS COMUNES

### Las imágenes no se ven
**Posibles causas:**
1. Las URLs en `product_images.public_url` no son accesibles
2. El bucket de Supabase no es público
3. Las políticas RLS bloquean el acceso
4. Los base_codes no coinciden

**Solución:**
```sql
-- Verificar bucket público
SELECT * FROM storage.buckets WHERE name = 'product-images';

-- Verificar políticas
SELECT * FROM storage.policies WHERE bucket_id = 'product-images';

-- Ver URLs de imágenes
SELECT base_code, public_url FROM product_images LIMIT 5;
```

### Los botones de colapsar no aparecen
**Causa:** El navegador tiene la versión antigua en caché

**Solución:**
1. Ctrl + Shift + R para recargar forzado
2. O borrar caché del navegador
3. O abrir en ventana de incógnito

### El grid no se reorganiza
**Causa:** Tailwind no está compilando las clases condicionales

**Solución:** Las clases ya están en el código, solo necesita recargar

## VERIFICACIÓN VISUAL

Deberías ver:
1. ✅ Botón con chevron a la izquierda de la barra de búsqueda
2. ✅ Al hacer click, el sidebar se contrae completamente
3. ✅ Botón "Carrito" en la esquina superior derecha
4. ✅ Al hacer click, se abre un panel desde la derecha
5. ✅ El grid se ajusta automáticamente al espacio disponible
6. ✅ Las imágenes de productos (si existen en la BD)

## SIGUIENTE PASO: GESTIÓN DE IMÁGENES

Una vez que el catálogo funcione correctamente, podemos mejorar:
1. Subida masiva de imágenes
2. Asociación de imágenes por color
3. Múltiples imágenes por producto
4. Editor de imágenes primarias
