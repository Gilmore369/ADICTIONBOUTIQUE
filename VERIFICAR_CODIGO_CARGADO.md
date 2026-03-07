# 🔍 VERIFICAR SI EL CÓDIGO NUEVO ESTÁ CARGADO

## ⚠️ PROBLEMA

El selector de tienda no se bloquea porque el navegador está usando código viejo en caché.

---

## ✅ PASO 1: VERIFICAR EN LA CONSOLA DEL NAVEGADOR

Abre la consola del navegador (F12) y ejecuta este código:

```javascript
// Verificar si el código nuevo está cargado
console.log('=== VERIFICACIÓN DE CÓDIGO ===')
console.log('Versión esperada: Con logs de debugging')
console.log('Busca en el código fuente si hay logs que empiecen con [POS]')
```

Luego, busca en el código fuente de la página:
1. Presiona `Ctrl + U` para ver el código fuente
2. Busca (Ctrl + F) el texto: `[POS] Cart items count`
3. Si NO encuentras ese texto, el código nuevo NO está cargado

---

## ✅ PASO 2: FORZAR RECARGA DEL CÓDIGO

### Opción A: Hard Refresh (PRUEBA ESTO PRIMERO)
```
Ctrl + Shift + R
```

### Opción B: Limpiar caché y recargar
1. Abre DevTools (F12)
2. Haz clic derecho en el botón de recargar
3. Selecciona "Vaciar caché y recargar de forma forzada"

### Opción C: Reiniciar el servidor de desarrollo
En la terminal donde corre el servidor:
```bash
# Detener el servidor
Ctrl + C

# Borrar la carpeta .next (caché de Next.js)
rm -rf .next

# O en Windows PowerShell:
Remove-Item -Recurse -Force .next

# Reiniciar el servidor
npm run dev
```

---

## ✅ PASO 3: VERIFICAR QUE EL SERVIDOR ESTÁ CORRIENDO

En la terminal, deberías ver algo como:
```
> next dev
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - ready in X ms
```

Si no ves esto, el servidor NO está corriendo. Inícialo con:
```bash
npm run dev
```

---

## ✅ PASO 4: VERIFICAR EN LA PÁGINA

Después de hacer hard refresh:

1. **Ve a la página POS**: `http://localhost:3000/pos`

2. **Abre la consola** (F12)

3. **Deberías ver este log**:
   ```
   [POS] Cart items count: 0 Should block selector: false
   ```

4. **Busca un producto y agrégalo al carrito**

5. **Deberías ver**:
   ```
   [POS] Cart items count: 1 Should block selector: true
   ```

6. **Verifica visualmente**:
   - ✅ El label dice "Tienda 🔒"
   - ✅ El selector se ve gris (deshabilitado)
   - ✅ Aparece el mensaje "🔒 Tienda bloqueada con productos en carrito"

7. **Intenta cambiar la tienda**:
   - Haz clic en el selector
   - Deberías ver en consola:
     ```
     [POS] Intentando cambiar tienda. Items en carrito: 1
     [POS] BLOQUEADO - No se puede cambiar con productos en carrito
     ```

---

## ❌ SI DESPUÉS DE TODO ESTO SIGUE SIN FUNCIONAR

Hay 3 posibilidades:

### 1. El código no se está compilando
Revisa la terminal donde corre `npm run dev`. ¿Hay errores?

### 2. Estás viendo una página diferente
Verifica que estás en: `http://localhost:3000/pos` (o el puerto correcto)

### 3. Hay un error de JavaScript
Abre la consola (F12) y busca errores en rojo.

---

## 🔧 SOLUCIÓN DEFINITIVA: REBUILD COMPLETO

Si nada funciona, haz un rebuild completo:

```bash
# 1. Detener el servidor
Ctrl + C

# 2. Borrar node_modules y .next
rm -rf node_modules .next

# En Windows PowerShell:
Remove-Item -Recurse -Force node_modules, .next

# 3. Reinstalar dependencias
npm install

# 4. Reiniciar el servidor
npm run dev
```

---

## 📸 ENVÍAME ESTA INFORMACIÓN SI SIGUE FALLANDO

1. **Captura de la consola del navegador** (F12 → Console)
   - Debe mostrar si hay logs de `[POS]`
   - Debe mostrar si hay errores en rojo

2. **Captura de la terminal** donde corre `npm run dev`
   - Debe mostrar si hay errores de compilación

3. **Captura del selector** cuando hay productos en el carrito
   - Para ver si se ve deshabilitado o no

4. **Resultado de este comando en la consola del navegador**:
   ```javascript
   // Pega esto en la consola y envíame el resultado
   console.log('URL actual:', window.location.href)
   console.log('Código fuente contiene [POS]:', document.documentElement.innerHTML.includes('[POS]'))
   ```

---

**Última actualización:** 2026-03-05
**Estado:** Código correcto en el servidor, problema de caché del navegador
