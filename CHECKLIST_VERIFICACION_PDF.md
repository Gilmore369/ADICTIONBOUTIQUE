# Checklist de Verificación: PDF de Tickets

## Instrucciones
Sigue este checklist para verificar que el PDF de tickets funciona correctamente.

---

## ✅ Paso 1: Verificar el Logo

- [ ] El archivo `public/images/logo.png` existe
- [ ] El logo tiene un tamaño razonable (< 100 KB)
- [ ] El logo es PNG con fondo transparente

**Comando para verificar:**
```bash
ls -lh public/images/logo.png
```

**Resultado esperado:**
```
-rw-r--r-- 1 user user 6.6K Mar  6 22:00 public/images/logo.png
```

---

## ✅ Paso 2: Iniciar el Servidor

- [ ] El servidor Next.js está corriendo
- [ ] No hay errores en la consola
- [ ] El puerto 3000 está disponible

**Comando:**
```bash
npm run dev
```

**Resultado esperado:**
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Ready in X.Xs
```

---

## ✅ Paso 3: Hacer una Venta de Prueba

### 3.1 Venta al Contado

- [ ] Ir a http://localhost:3000/pos
- [ ] Buscar un producto (ej: "Camisa")
- [ ] Agregar al carrito
- [ ] Seleccionar "Contado"
- [ ] Hacer clic en "Completar Venta"
- [ ] Aparece el modal del ticket

### 3.2 Venta a Crédito (Opcional)

- [ ] Ir a http://localhost:3000/pos
- [ ] Buscar un producto
- [ ] Agregar al carrito
- [ ] Seleccionar "Crédito"
- [ ] Seleccionar un cliente
- [ ] Configurar número de cuotas (ej: 6)
- [ ] Hacer clic en "Completar Venta"
- [ ] Aparece el modal del ticket

---

## ✅ Paso 4: Descargar el PDF

- [ ] En el modal del ticket, hacer clic en el botón "PDF"
- [ ] Aparece el mensaje "Generando PDF..."
- [ ] El PDF se abre en una nueva pestaña del navegador
- [ ] El PDF se descarga automáticamente
- [ ] El nombre del archivo es correcto: `Ticket_V-XXXX.pdf` (NO es un UUID)

**Ejemplo de nombre correcto:**
```
✅ Ticket_V-0048.pdf
❌ fc5f8efc-0629-4a91-bbba-ee42f14adf68.pdf
```

---

## ✅ Paso 5: Verificar el Contenido del PDF

Abre el PDF descargado y verifica:

### 5.1 Encabezado
- [ ] Logo de ADICTION BOUTIQUE visible en la parte superior
- [ ] Nombre de la tienda: "ADICTION BOUTIQUE"
- [ ] Dirección: "Av. Principal 123, Trujillo"
- [ ] Teléfono: "(044) 555-9999"
- [ ] RUC: "20123456789"

### 5.2 Información del Ticket
- [ ] Fecha y hora de la venta
- [ ] Número de ticket (ej: "V-0048")
- [ ] Tipo de pago ("EFECTIVO" o "CRÉDITO")
- [ ] Nombre del cliente (si aplica)

### 5.3 Productos
- [ ] Lista de productos con cantidades
- [ ] Precios unitarios correctos
- [ ] Subtotales correctos
- [ ] Tabla bien formateada (no cortada)

### 5.4 Totales
- [ ] Subtotal correcto
- [ ] Descuento (si aplica)
- [ ] Total a pagar destacado
- [ ] Formato de moneda correcto (S/ XX.XX)

### 5.5 Plan de Cuotas (Solo para Crédito)
- [ ] Título: "PLAN DE CUOTAS (X cuotas)"
- [ ] Lista de cuotas con:
  - [ ] Número de cuota
  - [ ] Monto de la cuota
  - [ ] Fecha de vencimiento
- [ ] Todas las cuotas visibles (no cortadas)

### 5.6 Código QR
- [ ] Código QR visible en la parte inferior
- [ ] Texto: "DESCARGA TU TICKET"
- [ ] Texto: "Escanea para descargar tu ticket digital"

### 5.7 Footer
- [ ] Mensaje: "¡Gracias por su preferencia!"
- [ ] Mensaje: "Vuelva pronto a ADICTION BOUTIQUE"

---

## ✅ Paso 6: Verificar el Diseño

- [ ] El PDF NO se ve cortado
- [ ] Todo el contenido es visible
- [ ] No hay espacios en blanco excesivos
- [ ] El diseño es compacto (similar a ticket térmico)
- [ ] Las fuentes son legibles
- [ ] Los márgenes son adecuados

---

## ✅ Paso 7: Verificar el Tamaño del Archivo

- [ ] El tamaño del PDF es razonable:
  - Venta simple: 150-200 KB ✅
  - Venta con varios productos: 200-300 KB ✅
  - Venta a crédito con cuotas: 300-400 KB ✅
  - Tamaño > 500 KB: ⚠️ Revisar
  - Tamaño < 50 KB: ❌ Problema

**Comando para verificar:**
```bash
ls -lh ~/Downloads/Ticket_V-*.pdf
```

---

## ✅ Paso 8: Verificar Compatibilidad

Abre el PDF en diferentes visores:

- [ ] Adobe Acrobat Reader
- [ ] Microsoft Edge (visor integrado)
- [ ] Google Chrome (visor integrado)
- [ ] Firefox (visor integrado)

**Resultado esperado:**
El PDF se visualiza correctamente en todos los visores.

---

## ✅ Paso 9: Verificar el Código QR (Opcional)

- [ ] Escanear el código QR con un teléfono móvil
- [ ] El QR redirige a: `http://localhost:3000/tickets/V-XXXX`
- [ ] La página del ticket se carga correctamente

**Nota:** Si el servidor está en localhost, el QR solo funcionará en la misma red.

---

## ✅ Paso 10: Verificar Logs del Servidor

Revisa la consola del servidor y verifica:

- [ ] Mensaje: `[PDF] Logo cargado exitosamente`
- [ ] Mensaje: `[PDF] PDF generado exitosamente, tamaño: X bytes`
- [ ] Mensaje: `[generate-pdf] Generating PDF for sale: V-XXXX using method: jspdf`
- [ ] NO hay errores en rojo

**Ejemplo de logs correctos:**
```
[PDF] Logo cargado exitosamente
[generate-pdf] Generating PDF for sale: V-0048 using method: jspdf
[PDF] PDF generado exitosamente, tamaño: 245678 bytes
POST /api/sales/generate-pdf 200 in 2.5s
```

---

## 🎯 Resultado Final

Si todos los checkboxes están marcados (✅), el sistema de PDF está funcionando correctamente.

### Resumen de Verificación

- [ ] Logo visible
- [ ] Nombre de archivo correcto
- [ ] Contenido completo (no cortado)
- [ ] Diseño compacto
- [ ] Código QR funcional
- [ ] Tamaño de archivo adecuado
- [ ] Compatible con visores PDF
- [ ] Sin errores en logs

---

## 🐛 Problemas Comunes

### Problema 1: El logo no aparece
**Solución:**
1. Verificar que `public/images/logo.png` existe
2. Reiniciar el servidor
3. Limpiar caché del navegador

### Problema 2: El PDF se descarga con nombre UUID
**Solución:**
1. Limpiar caché del navegador (Ctrl + Shift + Delete)
2. Recargar la página del POS (Ctrl + F5)
3. Verificar que tienes la última versión del código

### Problema 3: El PDF se ve cortado
**Solución:**
1. Verificar que tienes la última versión de `lib/pdf/generate-simple-receipt.ts`
2. Reiniciar el servidor
3. Revisar logs del servidor para errores

### Problema 4: El PDF no se descarga
**Solución:**
1. Verificar que el navegador permite descargas automáticas
2. Revisar la carpeta de descargas
3. Intentar con otro navegador

---

## 📞 Soporte

Si encuentras algún problema que no está en este checklist:

1. Anota el número de ticket que intentaste descargar
2. Copia los logs del servidor
3. Toma una captura de pantalla del error
4. Reporta el problema con toda la información

---

## ✅ Confirmación Final

Una vez completado el checklist:

- [ ] He verificado todos los pasos
- [ ] El PDF se genera correctamente
- [ ] El PDF se descarga con el nombre correcto
- [ ] El contenido es completo y legible
- [ ] El logo de ADICTION BOUTIQUE es visible
- [ ] No hay errores en el servidor

**Fecha de verificación:** _______________

**Verificado por:** _______________

**Resultado:** ✅ APROBADO / ❌ REQUIERE CORRECCIONES

---

## 📝 Notas Adicionales

Espacio para notas o comentarios:

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```
