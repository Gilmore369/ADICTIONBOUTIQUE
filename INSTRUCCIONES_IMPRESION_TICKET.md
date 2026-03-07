# Instrucciones para Imprimir Tickets Correctamente

## Problema
Cuando haces click en "Imprimir", el navegador muestra toda la hoja en blanco en lugar de solo el contenido del ticket.

## Solución: Configurar Impresión en el Navegador

### Opción 1: Configuración Manual (Recomendada)

Cuando aparezca el diálogo de impresión:

1. **Tamaño de papel**: Selecciona "Personalizado" o "Custom"
2. **Ancho**: 80mm (o 3.15 pulgadas)
3. **Alto**: Automático o el mínimo disponible
4. **Márgenes**: 0 (sin márgenes)
5. **Escala**: 100%

### Opción 2: Usar PDF en Lugar de Imprimir

**Recomendación**: En lugar de usar el botón "Imprimir", usa el botón "PDF":

1. Click en botón "PDF" (no "Imprimir")
2. El PDF se descarga automáticamente
3. Abre el PDF descargado
4. Imprime desde el visor de PDF

**Ventajas del PDF**:
- El tamaño ya está configurado correctamente (80mm)
- No hay espacios en blanco
- Diseño limpio sin fondo negro
- Incluye código QR

### Opción 3: Configurar Impresora Térmica

Si tienes una impresora térmica de 80mm:

1. Configura la impresora en Windows:
   - Panel de Control > Dispositivos e impresoras
   - Click derecho en tu impresora > Preferencias de impresión
   - Tamaño de papel: 80mm x Continuo
   - Márgenes: 0

2. Al imprimir desde el navegador:
   - Selecciona tu impresora térmica
   - El ticket se imprimirá correctamente

## Resumen

**Mejor opción**: Usa el botón "PDF" en lugar de "Imprimir"
- Descarga el PDF
- Imprime desde el visor de PDF
- Resultado perfecto sin configuración adicional

## Nota Técnica

El problema ocurre porque los navegadores no siempre respetan la configuración `@page { size: 80mm auto }` en CSS. El PDF generado sí respeta este tamaño, por eso es la mejor opción.
