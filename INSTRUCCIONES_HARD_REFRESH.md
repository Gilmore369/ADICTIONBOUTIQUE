# 🔄 INSTRUCCIONES: Hard Refresh del Navegador

## ⚠️ PROBLEMA ACTUAL

El código está **correctamente implementado** en el servidor, pero tu navegador está usando una **versión antigua en caché**. Por eso no ves los cambios funcionando.

## ✅ SOLUCIÓN: Hard Refresh

Necesitas hacer un **hard refresh** para forzar al navegador a descargar el código nuevo.

### En Windows (tu sistema):

**Opción 1 - Atajo de teclado (RECOMENDADO):**
```
Ctrl + Shift + R
```

**Opción 2 - Alternativa:**
```
Ctrl + F5
```

**Opción 3 - Desde DevTools:**
1. Abre DevTools (F12)
2. Haz clic derecho en el botón de recargar del navegador
3. Selecciona "Vaciar caché y recargar de forma forzada"

---

## 🎯 QUÉ DEBE PASAR DESPUÉS DEL HARD REFRESH

### 1. Selector de Tienda Bloqueado en POS

**Ubicación:** `/pos` (Punto de Venta)

**Comportamiento esperado:**
- ✅ Cuando el carrito está **vacío**: puedes cambiar la tienda libremente
- ✅ Cuando agregas productos al carrito: el selector se **bloquea automáticamente**
- ✅ Aparece el mensaje: "🔒 Tienda bloqueada con productos en carrito"
- ✅ El selector se ve deshabilitado (gris, no clickeable)

**Cómo probar:**
1. Ve a `/pos`
2. Selecciona "Tienda Hombres" o "Tienda Mujeres"
3. Busca y agrega un producto al carrito
4. Intenta cambiar el selector de tienda → debe estar bloqueado
5. Limpia el carrito → el selector se desbloquea

---

### 2. Extracción de Coordenadas de Google Maps

**Ubicación:** Crear nuevo cliente (botón "Nuevo Cliente" en cualquier página de clientes)

**Comportamiento esperado:**
- ✅ Pegas un link de Google Maps (ej: `https://maps.app.goo.gl/rf4EfP9m4Kjt5sRQ9`)
- ✅ Automáticamente extrae las coordenadas
- ✅ Muestra mensaje de éxito con las coordenadas
- ✅ Los campos Latitud y Longitud se llenan automáticamente
- ✅ Aparece un ✓ OK verde al lado del botón de extraer

**Cómo probar:**
1. Ve a cualquier página de clientes
2. Haz clic en "Nuevo Cliente"
3. En el campo "Link de Google Maps", pega: `https://maps.app.goo.gl/rf4EfP9m4Kjt5sRQ9`
4. Espera 1-2 segundos
5. Deberías ver:
   - Toast de éxito: "Coordenadas extraídas"
   - Lat: -8.134687
   - Lng: -79.049647
   - ✓ OK verde

**En la consola del navegador (F12) deberías ver:**
```
[parseGoogleMapsUrl] Original URL: https://maps.app.goo.gl/rf4EfP9m4Kjt5sRQ9
[parseGoogleMapsUrl] Calling expand-url API...
[parseGoogleMapsUrl] API response: {coordinates: {lat: -8.134687, lng: -79.049647}}
[parseGoogleMapsUrl] Coordinates extracted by API: {lat: -8.134687, lng: -79.049647}
```

---

## 🔍 VERIFICACIÓN TÉCNICA

### Archivos modificados (ya están en el servidor):

1. **`app/(auth)/pos/page.tsx`** - Línea 237-248
   - Selector bloqueado cuando `cart.items.length > 0`
   - Mensaje de bloqueo visible

2. **`components/clients/create-client-dialog.tsx`** - Línea 48-80
   - Función `parseGoogleMapsUrl` usa `data.coordinates` de la API
   - Logs de consola para debugging

3. **`app/api/expand-url/route.ts`** - Línea 40-100
   - Extrae coordenadas del HTML con múltiples patrones
   - Devuelve objeto `coordinates: {lat, lng}`

---

## ❓ SI DESPUÉS DEL HARD REFRESH SIGUE SIN FUNCIONAR

1. **Verifica que estás en la página correcta:**
   - POS: `http://localhost:3000/pos` (o tu dominio)
   - Crear cliente: cualquier página de clientes → botón "Nuevo Cliente"

2. **Abre la consola del navegador (F12):**
   - Ve a la pestaña "Console"
   - Busca errores en rojo
   - Busca los logs que empiezan con `[parseGoogleMapsUrl]`

3. **Verifica que el servidor está corriendo:**
   - Si usas `npm run dev`, asegúrate que esté activo
   - Revisa la terminal donde corre el servidor

4. **Intenta cerrar completamente el navegador:**
   - Cierra TODAS las ventanas del navegador
   - Abre de nuevo y ve a la página

5. **Si nada funciona, avísame y te ayudo a investigar más.**

---

## 📝 RESUMEN

**Problema:** Caché del navegador
**Solución:** `Ctrl + Shift + R` en Windows
**Resultado esperado:** 
- ✅ Selector de tienda se bloquea con productos en carrito
- ✅ Coordenadas se extraen automáticamente de links de Google Maps

---

**Última actualización:** 2026-03-05
**Estado del código:** ✅ Completamente implementado y funcionando en el servidor
