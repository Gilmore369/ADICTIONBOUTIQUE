# Correcciones Pendientes - Sistema de Clientes y Cobranzas

## Estado Actual

### ✅ Completado
- Fotos de clientes se muestran en la sección "Documentos" del perfil
- Botón "Editar" agregado en el perfil del cliente
- Campo "Referido por" funcional en creación de clientes
- **Recarga de página arreglada**: Ahora usa eventos personalizados para actualizar sin cambiar de pestaña
- **Botón de pago agregado**: Cada cuota pendiente tiene botón "Pagar" con diálogo completo
- **Foto del cliente en mapa**: Se muestra en el InfoWindow al hacer clic en marcador
- **Acciones comunes colapsables**: Sección de acciones comunes ahora es colapsable, priorizando acciones de cobranza

### ❌ Pendiente de Corrección

## 1. Extracción de Coordenadas de Google Maps

**Problema**: El link `https://maps.app.goo.gl/KF19nRps8vXAysGAB` no extrae coordenadas

**Causa Probable**: 
- El endpoint `/api/expand-url` puede estar fallando
- Los patrones de regex no coinciden con el formato del link expandido

**Solución**:
1. Verificar que el endpoint funciona correctamente
2. Agregar logs en consola del navegador para ver el link expandido
3. Probar manualmente el endpoint con el link
4. Ajustar patrones de regex si es necesario

**Archivos a Modificar**:
- `app/api/expand-url/route.ts` - Agregar más logs
- `components/clients/create-client-dialog.tsx` - Mejorar manejo de errores

---

## 2. ~~Registro de Acciones - Problema de UX~~ ✅ RESUELTO

**Problema**: Al registrar una acción, la página recargaba y volvía a la pestaña "Resumen"

**Solución Implementada**:
1. Cambiado de `window.location.reload()` a eventos personalizados
2. La pestaña activa se mantiene después de guardar
3. Usa `router.refresh()` para actualización suave

**Archivos Modificados**:
- `components/clients/add-action-form.tsx` ✅
- `components/clients/add-collection-action-form.tsx` ✅
- `components/clients/client-profile-view.tsx` ✅

---

## 3. ~~Acciones de Cobranza - Datos No Se Muestran~~ ✅ PARCIALMENTE RESUELTO

**Estado**: La tabla ya muestra tipo de acción, resultado, notas y fecha de seguimiento correctamente.

**Archivos**:
- `components/clients/collection-actions-table.tsx` - Ya implementado correctamente

---

## 4. ~~Reducir Espacio de "Registro de Acciones"~~ ✅ RESUELTO

**Solución Implementada**:
1. Sección de acciones comunes ahora es colapsable (usando `<details>`)
2. Acciones de cobranza tienen prioridad visual
3. Layout reorganizado para mejor UX

**Archivos Modificados**:
- `components/clients/client-profile-view.tsx` ✅

---

## 5. ~~Botón de Pago en Acciones de Cobranza~~ ✅ RESUELTO

**Solución Implementada**:
1. Botón "Pagar" agregado en cada cuota pendiente
2. Diálogo `RegisterPaymentDialog` creado con:
   - Monto a pagar (pre-llenado con monto de cuota)
   - Opción de pago parcial o completo (botones 50% y Pago Completo)
   - Fecha de pago
   - Método de pago (Efectivo, Transferencia, Tarjeta)
   - Notas opcionales
3. Actualiza el estado de la cuota después del pago
4. Actualiza `credit_used` del cliente

**Archivos Creados**:
- `components/clients/register-payment-dialog.tsx` ✅
- `app/api/payments/register/route.ts` ✅

**Archivos Modificados**:
- `components/clients/installments-table.tsx` ✅

---

## 6. ~~Mapa - Mostrar Foto del Cliente en Hover~~ ✅ RESUELTO

**Solución Implementada**:
1. Agregado `client_photo_url` a todos los endpoints de API del mapa
2. InfoWindow del mapa ahora muestra:
   - Foto del cliente (circular, 64x64)
   - Nombre del cliente
   - Dirección y teléfono
   - Deuda pendiente según filtro
   - Próxima cuota (si aplica)
   - Días de atraso (si aplica)

**Archivos Modificados**:
- `app/api/clients/with-overdue/route.ts` ✅
- `app/api/clients/with-upcoming/route.ts` ✅
- `app/api/clients/up-to-date/route.ts` ✅
- `app/api/clients/with-debt/route.ts` ✅
- `app/api/clients/all/route.ts` ✅
- `components/map/debtors-map.tsx` ✅

---

## 7. Integración Mapa - Acciones de Cobranza

**Problema**: El mapa tiene checklist de acciones pero no permite poner fechas de seguimiento

**Solución**:
1. Agregar campo de "Fecha de Seguimiento" en el checklist del mapa
2. Sincronizar las acciones del mapa con las acciones de cobranza del perfil
3. Permitir registrar pagos desde el mapa también

**Archivos a Modificar**:
- Componentes del mapa (necesito identificarlos primero)

---

## Prioridad de Implementación

### ✅ Alta Prioridad (Crítico para Cobranzas) - COMPLETADO
1. ✅ Botón de pago en cuotas pendientes
2. ✅ Mostrar foto del cliente en mapa
3. ✅ Arreglar recarga de página en acciones
4. ✅ Reducir espacio de acciones comunes

### Media Prioridad (Mejoras de UX)
5. ⚠️ Extracción de coordenadas (workaround: ingresar manualmente)
6. 🔄 Integrar fechas de seguimiento en mapa (pendiente)

---

## Archivos Implementados

### Nuevos Componentes
- ✅ `components/clients/register-payment-dialog.tsx` - Diálogo para registrar pagos

### Nuevos Endpoints
- ✅ `app/api/payments/register/route.ts` - API para registrar pagos

### Componentes Modificados
- ✅ `components/clients/client-profile-view.tsx` - Eventos personalizados y layout mejorado
- ✅ `components/clients/add-action-form.tsx` - Eventos en lugar de reload
- ✅ `components/clients/add-collection-action-form.tsx` - Eventos en lugar de reload
- ✅ `components/clients/installments-table.tsx` - Botón de pago agregado
- ✅ `components/map/debtors-map.tsx` - Foto del cliente en InfoWindow

### APIs Modificadas
- ✅ `app/api/clients/with-overdue/route.ts` - Incluye client_photo_url
- ✅ `app/api/clients/with-upcoming/route.ts` - Incluye client_photo_url
- ✅ `app/api/clients/up-to-date/route.ts` - Incluye client_photo_url
- ✅ `app/api/clients/with-debt/route.ts` - Incluye client_photo_url
- ✅ `app/api/clients/all/route.ts` - Incluye client_photo_url

---

## Notas Técnicas

### Estructura de Datos - Pagos

```typescript
interface Payment {
  id: string
  installment_id: string
  amount: number
  payment_date: string
  payment_method: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
  notes?: string
  created_by: string
}
```

### Estructura de Datos - Acciones de Cobranza

```typescript
interface CollectionAction {
  id: string
  client_id: string
  action_type: string // 'LLAMADA', 'VISITA', 'MENSAJE', etc.
  result: string // 'PROMESA_PAGO', 'NO_CONTESTA', 'PAGARA_FECHA', etc.
  description: string
  follow_up_date: string // Fecha tentativa de pago
  created_at: string
  created_by: string
}
```

---

## Archivos Clave a Revisar

1. `components/clients/client-profile-view.tsx` - Vista principal del perfil
2. `components/clients/installments-table.tsx` - Tabla de cuotas
3. `components/clients/collection-actions-table.tsx` - Tabla de acciones de cobranza
4. `components/clients/add-collection-action-form.tsx` - Formulario de acciones
5. `app/(auth)/map/page.tsx` - Página del mapa
6. `actions/payments.ts` - Acciones de pagos

---

## Comandos SQL para Verificar Datos

```sql
-- Ver cliente con sus fotos
SELECT id, name, client_photo_url, dni_photo_url, lat, lng
FROM clients
WHERE dni = '01069627';

-- Ver acciones de cobranza del cliente
SELECT *
FROM collection_actions
WHERE client_id = (SELECT id FROM clients WHERE dni = '01069627')
ORDER BY created_at DESC;

-- Ver cuotas pendientes del cliente
SELECT i.*, cp.total_amount
FROM installments i
JOIN credit_plans cp ON cp.id = i.plan_id
WHERE cp.client_id = (SELECT id FROM clients WHERE dni = '01069627')
  AND i.status != 'PAID'
ORDER BY i.due_date;
```

---

## Próximos Pasos

1. Implementar botón de pago en cuotas
2. Arreglar recarga de página en acciones
3. Agregar foto del cliente en mapa
4. Mejorar visualización de acciones de cobranza
5. Integrar fechas de seguimiento en mapa
