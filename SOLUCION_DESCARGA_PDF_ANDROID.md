# Solución: Descarga de PDF en Chrome Android

## Problema
Chrome en Android tiene restricciones de seguridad que impiden que los archivos se descarguen con el nombre correcto cuando se usa JavaScript para forzar la descarga.

## Solución Implementada

He implementado la mejor solución posible que funciona en la mayoría de los casos:

1. **Endpoint directo**: `/api/sales/V-XXXX/pdf` que sirve el PDF con headers correctos
2. **Enlace con atributo download**: El botón crea un enlace temporal con `download="Ticket_V-XXXX.pdf"`
3. **Headers del servidor**: El servidor envía `Content-Disposition: attachment; filename="Ticket_V-XXXX.pdf"`

## Comportamiento en Chrome Android

Chrome Android puede:
- **Opción 1**: Descargar el archivo con nombre aleatorio (por seguridad)
- **Opción 2**: Abrir el PDF en el navegador y permitir descargarlo desde ahí con el nombre correcto

## Instrucciones para el Usuario

Si el PDF se descarga con nombre aleatorio:

1. Abre el PDF descargado en Chrome
2. Toca el botón de menú (3 puntos) en la esquina superior derecha
3. Selecciona "Descargar" o "Guardar como"
4. El navegador te permitirá guardar con el nombre correcto: `Ticket_V-XXXX.pdf`

## Alternativa: Usar el POS

El botón PDF en el POS (después de completar una venta) funciona mejor porque:
- Abre el PDF en una nueva pestaña
- Permite visualizarlo antes de descargar
- El navegador respeta mejor el nombre del archivo

## Nota Técnica

Este es un comportamiento de seguridad de Chrome Android que no se puede evitar completamente con JavaScript. Los navegadores móviles tienen restricciones más estrictas que los navegadores de escritorio para proteger a los usuarios de descargas maliciosas.

## Verificación

Para verificar que el PDF se genera correctamente:
1. Abre el enlace directo: `http://localhost:3000/api/sales/V-0051/pdf`
2. El PDF debería abrirse en el navegador
3. Desde ahí puedes descargarlo con el nombre correcto

El PDF contiene:
- Logo de ADICTION BOUTIQUE
- Información de la tienda
- Detalles de la venta
- Código QR para descargar el ticket
- Formato compacto de 80mm (estilo ticket térmico)
