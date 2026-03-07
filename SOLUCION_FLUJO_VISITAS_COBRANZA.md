# Solución: Flujo Coherente de Visitas y Cobranzas

## Problema Identificado

El sistema de visitas en el mapa no era coherente con los resultados registrados:
- No se capturaba información de pagos cuando el resultado era "Pagó" o "Abono parcial"
- No se registraba fecha de promesa cuando el resultado era "Prometió pagar"
- Las evidencias fotográficas no se vinculaban con las acciones de cobranza
- No había forma de generar un reporte profesional al finalizar la ruta
- Las visitas no se visualizaban en el perfil del cliente

## Solución Implementada

### 1. Base de Datos - Migración Mejorada

**Archivo:** `supabase/migrations/20260306000000_enhance_visits_with_payments.sql`

Se agregaron los siguientes campos a la tabla `client_visits`:
- `payment_amount`: Monto pagado durante la visita
- `payment_method`: Método de pago (EFECTIVO, YAPE, PLIN, TRANSFERENCIA, TARJETA)
- `payment_proof_url`: URL de la foto del comprobante de pago
- `promise_date`: Fecha de promesa de pago
- `promise_amount`: Monto prometido
- `collection_action_id`: Vinculación con la tabla collection_actions
- `notes`: Notas adicionales

### 2. Componente de Registro de Visitas Mejorado

**Archivo:** `components/map/register-visit-dialog.tsx`

**Cambios principales:**
- Cada resultado ahora tiene flags `requiresPayment` y `requiresPromise`
- Cuando el resultado es "Pagó" o "Abono parcial":
  - ✅ Se solicita el monto del pago (obligatorio)
  - ✅ Se solicita el método de pago (obligatorio)
  - ✅ Se solicita foto del comprobante o pantallazo (obligatorio)
- Cuando el resultado es "Prometió pagar":
  - ✅ Se solicita la fecha de promesa (obligatorio)
  - ✅ Se solicita el monto prometido (obligatorio)
- Validación coherente antes de guardar

### 3. API de Visitas Actualizada

**Archivo:** `app/api/visits/route.ts`

**Mejoras:**
- Guarda todos los campos nuevos (pagos, promesas, evidencias)
- Crea automáticamente una acción de cobranza vinculada
- Mapea los resultados de visita a resultados de collection_actions:
  - "Pagó" → PAGO_REALIZADO
  - "Abono parcial" → PAGO_PARCIAL
  - "Prometió pagar" → PROMETE_PAGAR_FECHA
  - "No estaba" → CLIENTE_NO_UBICADO
  - "Rechazó" → SE_NIEGA_PAGAR
  - etc.
- Vincula la visita con la acción de cobranza mediante `collection_action_id`

### 4. Reporte Profesional de Ruta

**Archivo:** `components/map/route-report-dialog.tsx`

**Características:**
- Resumen ejecutivo con estadísticas:
  - Total de visitas realizadas
  - Pagos recibidos
  - Promesas de pago
  - Rechazos/Sin respuesta
- Detalle completo de cada visita con:
  - Hora de la visita
  - Resultado
  - Dirección y teléfono
  - Deuda vencida (si aplica)
- Descarga en formato texto profesional
- Diseño visual con tarjetas de resumen

### 5. Panel de Visitas Mejorado

**Archivo:** `components/map/visit-panel.tsx`

**Mejoras:**
- Botón "Generar Reporte" visible cuando hay visitas completadas
- Muestra el contador de visitas completadas
- Integración con el diálogo de reporte

### 6. Visualización en Perfil del Cliente

**Archivos:**
- `components/clients/client-visits-table.tsx` (nuevo)
- `components/clients/client-profile-view.tsx` (actualizado)

**Características:**
- Nueva pestaña "Visitas" en el perfil del cliente
- Muestra historial completo de visitas con:
  - Fecha y hora
  - Tipo de visita (Cobranza, Activación, etc.)
  - Resultado
  - Comentarios
  - Información de pagos (monto, método)
  - Información de promesas (fecha, monto)
  - Miniaturas de fotos de evidencia
  - Miniaturas de comprobantes de pago
- Visor de imágenes en pantalla completa al hacer clic
- Código de colores según el resultado

## Flujo Completo del Usuario

### Escenario 1: Cliente Pagó

1. Usuario selecciona cliente en el mapa
2. Hace clic en "Registrar visita"
3. Selecciona resultado "Pagó"
4. **Sistema solicita automáticamente:**
   - Monto del pago ✅
   - Método de pago (EFECTIVO/YAPE/PLIN/etc.) ✅
   - Foto del comprobante ✅
5. Usuario completa los campos y guarda
6. **Sistema automáticamente:**
   - Guarda la visita con toda la información
   - Crea una acción de cobranza tipo "VISITA" con resultado "PAGO_REALIZADO"
   - Vincula ambos registros
   - Las evidencias quedan disponibles en:
     - Historial de visitas del cliente
     - Acciones de cobranza
     - Reporte de ruta

### Escenario 2: Cliente Prometió Pagar

1. Usuario selecciona cliente en el mapa
2. Hace clic en "Registrar visita"
3. Selecciona resultado "Prometió pagar"
4. **Sistema solicita automáticamente:**
   - Fecha de promesa ✅
   - Monto prometido ✅
5. Usuario completa los campos y guarda
6. **Sistema automáticamente:**
   - Guarda la visita con la promesa
   - Crea una acción de cobranza tipo "VISITA" con resultado "PROMETE_PAGAR_FECHA"
   - Registra la fecha de promesa en `payment_promise_date`
   - Vincula ambos registros

### Escenario 3: Finalizar Ruta

1. Usuario completa todas las visitas de su lista
2. Hace clic en "Generar Reporte"
3. **Sistema muestra:**
   - Resumen ejecutivo con estadísticas
   - Detalle de cada visita
   - Botón para descargar reporte en texto
4. Usuario descarga el reporte profesional
5. Puede compartir el reporte con supervisores

### Escenario 4: Consultar Historial

1. Usuario entra al perfil del cliente
2. Hace clic en la pestaña "Visitas"
3. **Sistema muestra:**
   - Todas las visitas realizadas
   - Fotos de evidencia (clic para ampliar)
   - Comprobantes de pago (clic para ampliar)
   - Información de pagos y promesas
   - Comentarios y notas

## Vinculación de Datos

```
client_visits
├── id
├── client_id → clients.id
├── collection_action_id → collection_actions.id ✅ NUEVO
├── image_url (foto de la visita)
├── payment_proof_url (comprobante de pago) ✅ NUEVO
├── payment_amount ✅ NUEVO
├── payment_method ✅ NUEVO
├── promise_date ✅ NUEVO
└── promise_amount ✅ NUEVO

collection_actions
├── id
├── client_id → clients.id
├── action_type = 'VISITA'
├── result (mapeado desde visit.result)
└── payment_promise_date (copiado desde visit.promise_date)
```

## Beneficios

1. **Coherencia Total:** El sistema solicita exactamente la información necesaria según el resultado
2. **Evidencias Completas:** Todas las fotos y comprobantes quedan registrados y vinculados
3. **Trazabilidad:** Las visitas se vinculan automáticamente con acciones de cobranza
4. **Reportes Profesionales:** Generación automática de reportes detallados
5. **Visibilidad:** Las evidencias se pueden consultar desde múltiples puntos:
   - Perfil del cliente (pestaña Visitas)
   - Acciones de cobranza
   - Reporte de ruta
6. **Validación:** No se puede guardar una visita sin la información requerida

## Próximos Pasos (Opcional)

1. Agregar notificaciones automáticas cuando se acerca la fecha de promesa
2. Integrar con sistema de pagos para registrar automáticamente los pagos
3. Agregar firma digital del cliente en las visitas
4. Exportar reportes en PDF con fotos incluidas
5. Dashboard de métricas de visitas por usuario/período

## Ejecución de la Migración

Para aplicar los cambios en la base de datos:

```bash
# Conectarse a Supabase y ejecutar:
supabase/migrations/20260306000000_enhance_visits_with_payments.sql
```

O desde el panel de Supabase:
1. Ir a SQL Editor
2. Copiar y pegar el contenido del archivo de migración
3. Ejecutar

## Notas Técnicas

- Las fotos se almacenan en Supabase Storage bucket "visit-images"
- Los comprobantes de pago tienen un borde verde distintivo en las miniaturas
- El sistema valida que las imágenes no superen 5 MB
- Las fechas de promesa no pueden ser anteriores a hoy
- Los montos deben ser mayores a 0
