# Instrucciones: Cómo Usar el Nuevo PDF de Tickets

## ¿Qué se Corrigió?

He solucionado los problemas del PDF de tickets:

1. ✅ **Nombre del archivo correcto**: Ahora se descarga como `Ticket_V-0048.pdf` en lugar de un UUID aleatorio
2. ✅ **Contenido completo**: El PDF ya no se corta, muestra todo el contenido
3. ✅ **Logo incluido**: El logo de ADICTION BOUTIQUE aparece en la parte superior
4. ✅ **Diseño compacto**: Formato de 80mm sin espacios innecesarios
5. ✅ **Altura dinámica**: Se ajusta automáticamente al contenido (productos + cuotas)

## Cómo Generar un Ticket PDF

### Paso 1: Hacer una Venta
1. Ve al POS: http://localhost:3000/pos
2. Busca y agrega productos al carrito
3. Selecciona el tipo de venta:
   - **Contado**: Para ventas en efectivo
   - **Crédito**: Para ventas a crédito (puedes configurar cuotas)
4. Haz clic en "Completar Venta"

### Paso 2: Descargar el PDF
1. Después de completar la venta, aparecerá el modal del ticket
2. Haz clic en el botón **"PDF"** (icono de descarga)
3. El PDF se abrirá en una nueva pestaña del navegador
4. Automáticamente se descargará con el nombre correcto: `Ticket_V-XXXX.pdf`

### Paso 3: Verificar el PDF
Abre el PDF descargado y verifica que contenga:

- ✅ Logo de ADICTION BOUTIQUE en la parte superior
- ✅ Información de la tienda (dirección, teléfono, RUC)
- ✅ Número de ticket (V-XXXX)
- ✅ Fecha y hora de la venta
- ✅ Tipo de pago (EFECTIVO o CRÉDITO)
- ✅ Nombre del cliente (si aplica)
- ✅ Lista de productos con cantidades y precios
- ✅ Totales (subtotal, descuento, total)
- ✅ Plan de cuotas (si es venta a crédito)
- ✅ Código QR para descargar el ticket digital
- ✅ Mensaje de agradecimiento

## Características del PDF

### Diseño Compacto
- Ancho: 80mm (formato de ticket térmico)
- Altura: Dinámica (se ajusta al contenido)
- Sin espacios en blanco innecesarios
- Fuentes pequeñas pero legibles

### Logo
- Ubicación: Parte superior del ticket
- Tamaño: 100x40 puntos
- Formato: PNG con fondo transparente

### Código QR
- Ubicación: Parte inferior del ticket
- Tamaño: 80x80 puntos
- Función: Permite descargar el ticket digital escaneando el código

### Plan de Cuotas (Solo para Crédito)
Si la venta es a crédito con cuotas, el PDF mostrará:
- Número de cuotas
- Monto de cada cuota
- Fecha de vencimiento de cada cuota

Ejemplo:
```
PLAN DE CUOTAS (6 cuotas)
Cuota 1:  S/ 15.83  06/04/2026
Cuota 2:  S/ 15.83  06/05/2026
Cuota 3:  S/ 15.83  06/06/2026
...
```

## Tamaño del Archivo

El tamaño del PDF varía según el contenido:
- **Venta simple (1-2 productos, contado)**: ~150-200 KB
- **Venta con varios productos**: ~200-300 KB
- **Venta a crédito con cuotas**: ~300-400 KB

## Compatibilidad

El PDF es compatible con:
- ✅ Adobe Acrobat Reader
- ✅ Microsoft Edge (visor PDF integrado)
- ✅ Google Chrome (visor PDF integrado)
- ✅ Firefox (visor PDF integrado)
- ✅ Impresoras térmicas de 80mm
- ✅ Impresoras láser/inkjet estándar

## Solución de Problemas

### El PDF no se descarga
1. Verifica que el navegador permite descargas automáticas
2. Revisa la carpeta de descargas del navegador
3. Intenta hacer clic derecho en el PDF abierto → "Guardar como"

### El logo no aparece
1. El logo debe estar en: `public/images/logo.png`
2. Tamaño recomendado: 400x200 pixels
3. Formato: PNG con fondo transparente
4. Peso: Menos de 100KB

### El PDF se ve cortado
1. Asegúrate de tener la última versión del código
2. Verifica que el servidor esté corriendo correctamente
3. Revisa los logs del servidor para errores

### El nombre del archivo es UUID
1. Asegúrate de tener la última versión del código
2. Limpia la caché del navegador (Ctrl + Shift + Delete)
3. Recarga la página del POS (Ctrl + F5)

## Otras Opciones

Además del botón PDF, también puedes:

1. **Imprimir**: Haz clic en el botón "Imprimir" para imprimir directamente
2. **Enviar por Email**: Haz clic en el botón "Email" para enviar el ticket por correo
3. **Ver en línea**: Usa el código QR para ver el ticket en línea

## Notas Importantes

- El PDF se genera en el servidor usando jsPDF (más compatible con Windows)
- El logo se carga desde el sistema de archivos del servidor
- El código QR contiene la URL para descargar el ticket: `http://localhost:3000/tickets/V-XXXX`
- El PDF es compatible con el estándar PDF/A para archivo a largo plazo

## Contacto

Si tienes problemas o sugerencias, por favor reporta:
1. Número de ticket que intentaste descargar
2. Tipo de venta (contado/crédito)
3. Navegador que estás usando
4. Mensaje de error (si aparece alguno)
