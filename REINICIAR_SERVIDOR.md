# INSTRUCCIONES PARA VER LOS CAMBIOS EN EL CATÁLOGO VISUAL

## ⚠️ IMPORTANTE: Debes reiniciar el servidor de desarrollo

Los cambios realizados en el componente `visual-catalog.tsx` requieren que reinicies el servidor de desarrollo de Next.js para que se apliquen correctamente.

## Pasos a seguir:

### 1. Detener el servidor actual
En la terminal donde está corriendo `npm run dev`, presiona:
- **Ctrl + C** (Windows/Linux)
- **Cmd + C** (Mac)

### 2. Limpiar la caché (ya hecho)
✅ La caché de `.next` ya fue eliminada automáticamente

### 3. Reiniciar el servidor
```bash
npm run dev
```

### 4. Abrir el navegador
Ve a: `http://localhost:3000/catalogs/visual`

### 5. Forzar recarga completa en el navegador
- **Ctrl + Shift + R** (Windows/Linux)
- **Cmd + Shift + R** (Mac)
- O presiona **F12** para abrir DevTools, luego click derecho en el botón de recargar y selecciona "Vaciar caché y recargar de forma forzada"

## Cambios implementados:

### ✅ Sidebar izquierda colapsable
- Botón con ícono de chevron en la barra superior
- Al hacer click, la sidebar se oculta/muestra con animación
- El grid se adapta automáticamente al espacio disponible

### ✅ Carrito derecho colapsable
- El botón "Carrito" en la barra superior ahora dice "Ocultar" cuando está abierto
- Al hacer click, el carrito se oculta/muestra con animación
- Aparece como drawer deslizable desde la derecha

### ✅ Grid responsive
- Se adapta automáticamente según el espacio disponible:
  - Ambos paneles abiertos: 2-4 columnas
  - Un panel abierto: 2-5 columnas
  - Ambos cerrados: 2-7 columnas (máximo espacio)

### ✅ Imágenes de productos
- El componente ahora carga imágenes desde la tabla `product_images`
- Prioriza imágenes marcadas como `is_primary = true`
- Fallback a `products.image_url` si no hay imágenes en `product_images`
- Logs en consola para debugging (abre DevTools con F12)

## Verificar en la consola del navegador:

Abre las DevTools (F12) y busca estos mensajes:
```
[VisualCatalog] Render - sidebarOpen: true cartOpen: false models: X
[VisualCatalog] Imágenes cargadas: X
[VisualCatalog] Asignando imagen a XXX: https://...
```

## Si las imágenes aún no aparecen:

Ejecuta este script en Supabase para verificar el estado:
```sql
-- Ver en: supabase/VERIFICAR_ESTADO_COMPLETO.sql
```

## Problemas comunes:

### El botón de toggle no aparece
- Asegúrate de haber reiniciado el servidor
- Verifica que no haya errores en la consola del navegador
- Limpia la caché del navegador completamente

### Las imágenes no cargan
- Verifica que existan registros en la tabla `product_images`
- Verifica que el bucket `product-images` sea público
- Verifica las políticas de storage (ver `supabase/STORAGE_POLICIES.sql`)
- Revisa los logs en la consola del navegador

### El grid no se adapta
- Verifica que los estados `sidebarOpen` y `cartOpen` cambien (ver consola)
- Asegúrate de que Tailwind CSS esté compilando correctamente
- Reinicia el servidor de desarrollo

## Contacto:
Si después de seguir estos pasos aún no ves los cambios, comparte:
1. Screenshot de la consola del navegador (F12)
2. Screenshot de la página
3. Confirma que reiniciaste el servidor
