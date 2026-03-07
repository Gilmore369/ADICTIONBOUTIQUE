# 🔍 DEBUG: Selector de Tienda No Se Bloquea

## ✅ CAMBIOS REALIZADOS

He agregado logs de debugging para verificar si el código nuevo se está cargando:

### 1. Log al cargar la página
```javascript
console.log('[POS] Cart items count:', cart.items.length, 'Should block selector:', cart.items.length > 0)
```

### 2. Log al intentar cambiar tienda
```javascript
console.log('[POS] Intentando cambiar tienda. Items en carrito:', cart.items.length)
```

### 3. Indicador visual en el label
- Ahora el label muestra "Tienda 🔒" cuando hay productos en el carrito

---

## 🧪 CÓMO VERIFICAR

### Paso 1: Hard Refresh OBLIGATORIO
**IMPORTANTE:** Debes hacer hard refresh para cargar el código nuevo:
```
Ctrl + Shift + R
```

### Paso 2: Abrir la Consola del Navegador
1. Presiona `F12` para abrir DevTools
2. Ve a la pestaña "Console"
3. Limpia la consola (botón 🚫 o Ctrl+L)

### Paso 3: Ir a la página POS
1. Ve a `/pos` (Punto de Venta)
2. En la consola deberías ver:
   ```
   [POS] Cart items count: 0 Should block selector: false
   ```

### Paso 4: Agregar un producto
1. Busca cualquier producto
2. Agrégalo al carrito
3. En la consola deberías ver:
   ```
   [POS] Cart items count: 1 Should block selector: true
   ```

### Paso 5: Intentar cambiar la tienda
1. Haz clic en el selector de tienda
2. Intenta seleccionar otra opción
3. En la consola deberías ver:
   ```
   [POS] Intentando cambiar tienda. Items en carrito: 1
   [POS] BLOQUEADO - No se puede cambiar con productos en carrito
   ```

### Paso 6: Verificar el comportamiento visual
- ✅ El selector debe verse deshabilitado (gris, opacidad 50%)
- ✅ El label debe mostrar "Tienda 🔒"
- ✅ Debe aparecer el mensaje "🔒 Tienda bloqueada con productos en carrito"
- ✅ El cursor debe cambiar a "not-allowed" al pasar sobre el selector

---

## ❌ SI NO VES LOS LOGS EN LA CONSOLA

Significa que el código nuevo **NO se ha cargado**. Intenta:

### Opción 1: Hard Refresh más agresivo
1. Cierra TODAS las pestañas del navegador
2. Cierra completamente el navegador
3. Abre el navegador de nuevo
4. Ve directamente a `/pos`

### Opción 2: Limpiar caché manualmente
1. Abre DevTools (F12)
2. Ve a la pestaña "Network"
3. Marca la casilla "Disable cache"
4. Recarga la página (F5)

### Opción 3: Verificar que el servidor está corriendo
1. Ve a la terminal donde corre `npm run dev`
2. Verifica que no haya errores
3. Si hay errores, detén el servidor (Ctrl+C) y reinícialo:
   ```bash
   npm run dev
   ```

### Opción 4: Forzar rebuild
1. Detén el servidor (Ctrl+C)
2. Borra la carpeta `.next`:
   ```bash
   rm -rf .next
   ```
3. Reinicia el servidor:
   ```bash
   npm run dev
   ```

---

## ✅ SI VES LOS LOGS PERO EL SELECTOR NO SE BLOQUEA

Si ves los logs en la consola pero el selector sigue funcionando, entonces hay un problema diferente:

### Verificar que `cart.items.length > 0` es verdadero
En la consola, cuando tengas productos en el carrito, escribe:
```javascript
// Esto debería mostrar el estado del carrito
console.log('Items:', cart.items.length)
```

### Verificar que el atributo `disabled` se está aplicando
1. Inspecciona el elemento `<select>` con las DevTools
2. Busca el atributo `disabled`
3. Debería estar presente cuando hay productos en el carrito

---

## 🎯 COMPORTAMIENTO ESPERADO

### Carrito vacío (0 items):
```
[POS] Cart items count: 0 Should block selector: false
```
- ✅ Selector habilitado
- ✅ Label: "Tienda"
- ✅ Sin mensaje de bloqueo
- ✅ Puedes cambiar de tienda

### Carrito con productos (1+ items):
```
[POS] Cart items count: 1 Should block selector: true
```
- ✅ Selector deshabilitado (gris)
- ✅ Label: "Tienda 🔒"
- ✅ Mensaje: "🔒 Tienda bloqueada con productos en carrito"
- ✅ No puedes cambiar de tienda
- ✅ Al intentar cambiar, se muestra log de bloqueo

---

## 📸 CAPTURA DE PANTALLA PARA DEBUGGING

Si después de seguir todos estos pasos el selector sigue sin bloquearse, envíame:

1. **Captura de la consola del navegador** mostrando los logs
2. **Captura del selector** cuando hay productos en el carrito
3. **Captura del inspector de elementos** mostrando el `<select>` y sus atributos

---

## 🔧 CÓDIGO MODIFICADO

### Archivo: `app/(auth)/pos/page.tsx`

**Línea ~70:** Log de debugging
```typescript
// Debug: Log when cart changes
console.log('[POS] Cart items count:', cart.items.length, 'Should block selector:', cart.items.length > 0)
```

**Línea ~265-285:** Selector con logs y bloqueo
```typescript
<Card className="p-3">
  <label className="text-xs font-medium text-gray-600 block mb-1">
    Tienda {cart.items.length > 0 && '🔒'}
  </label>
  <select
    value={warehouse}
    onChange={(e) => {
      console.log('[POS] Intentando cambiar tienda. Items en carrito:', cart.items.length)
      if (cart.items.length > 0) {
        console.log('[POS] BLOQUEADO - No se puede cambiar con productos en carrito')
        return
      }
      setWarehouse(e.target.value)
    }}
    disabled={processing || cart.items.length > 0}
    className="text-sm border rounded px-2 py-1 w-full disabled:opacity-50 disabled:cursor-not-allowed"
    title={cart.items.length > 0 ? 'No puedes cambiar de tienda con productos en el carrito' : ''}
  >
    <option value="Tienda Mujeres">Tienda Mujeres</option>
    <option value="Tienda Hombres">Tienda Hombres</option>
  </select>
  {cart.items.length > 0 && (
    <p className="text-xs text-amber-600 mt-1">
      🔒 Tienda bloqueada con productos en carrito
    </p>
  )}
</Card>
```

---

**Última actualización:** 2026-03-05
**Estado:** Código actualizado con logs de debugging
