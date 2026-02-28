# PASOS URGENTES PARA ARREGLAR EL CATÁLOGO VISUAL

## 🚨 PROBLEMA ACTUAL
El componente `visual-catalog.tsx` tiene los cambios implementados pero NO se está recompilando en tu navegador. Por eso sigues viendo la versión antigua.

## ✅ SOLUCIÓN (Sigue estos pasos EN ORDEN)

### PASO 1: Detener el servidor
En la terminal donde corre `npm run dev`, presiona:
```
Ctrl + C
```

### PASO 2: Verificar que se detuvo
Deberías ver que el proceso terminó. Si no, cierra la terminal y abre una nueva.

### PASO 3: Reiniciar el servidor
```bash
npm run dev
```

### PASO 4: Esperar a que compile
Espera a ver este mensaje:
```
✓ Ready in X.Xs
○ Local: http://localhost:3000
```

### PASO 5: Abrir el navegador
Ve a: `http://localhost:3000/catalogs/visual`

### PASO 6: Forzar recarga COMPLETA
Presiona **Ctrl + Shift + R** (o Cmd + Shift + R en Mac)

O:
1. Presiona **F12** para abrir DevTools
2. Click DERECHO en el botón de recargar (⟳)
3. Selecciona "Vaciar caché y recargar de forma forzada"

### PASO 7: Verificar en la consola
Con DevTools abierto (F12), ve a la pestaña "Console" y busca:
```
[VisualCatalog] Render - sidebarOpen: true cartOpen: false models: X
```

Si ves este mensaje, significa que el componente se recompiló correctamente.

## 🎯 QUÉ DEBERÍAS VER DESPUÉS

### 1. Botón para ocultar sidebar
- A la izquierda de la barra de búsqueda
- Ícono de chevron (< o >)
- Al hacer click, la sidebar se oculta/muestra

### 2. Botón del carrito mejorado
- En la esquina superior derecha
- Dice "Carrito" cuando está cerrado
- Dice "Ocultar" cuando está abierto
- Al hacer click, se abre un panel desde la derecha

### 3. Grid que se adapta
- Cuando ambos paneles están abiertos: menos columnas
- Cuando ambos están cerrados: más columnas
- Transición suave al cambiar

## 📊 VERIFICAR IMÁGENES

Si después de reiniciar el servidor los botones funcionan pero las imágenes no aparecen:

### Ejecuta este script en Supabase:
```sql
-- Ver archivo: supabase/VERIFICAR_IMAGENES_SIMPLE.sql
```

### Deberías ver:
1. `tabla_existe = true`
2. `total_imagenes > 0`
3. Lista de imágenes con sus URLs

### Si no hay imágenes:
Necesitas subir imágenes a Supabase Storage o vincular las existentes a la tabla `product_images`.

## ❌ SI AÚN NO FUNCIONA

Comparte:
1. Screenshot de la consola del navegador (F12 → Console)
2. Screenshot de la terminal donde corre `npm run dev`
3. Confirma que seguiste TODOS los pasos en orden

## 📝 NOTAS IMPORTANTES

- ✅ La caché de `.next` ya fue eliminada
- ✅ Los cambios están en el código
- ✅ Las políticas de storage están configuradas (vi tu screenshot)
- ⚠️ DEBES reiniciar el servidor para que se apliquen
- ⚠️ DEBES forzar recarga en el navegador

## 🔍 DEBUG ADICIONAL

Si ves los botones pero no funcionan, abre la consola y escribe:
```javascript
// Verificar que React está renderizando el componente correcto
document.querySelector('[title="Ocultar filtros"]') || document.querySelector('[title="Mostrar filtros"]')
```

Si esto devuelve `null`, el componente no se recompiló.
Si devuelve un elemento HTML, el componente está correcto.
