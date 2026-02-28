# Mejoras en el Módulo de Cobranza

## Resumen de Cambios

Se ha mejorado significativamente el módulo de acciones de cobranza con opciones más profesionales y completas para la gestión de cobranza.

## 1. Nuevos Tipos de Acción

Se agregaron más canales de comunicación:

| Tipo | Descripción | Icono |
|------|-------------|-------|
| LLAMADA | Llamada Telefónica | 📞 |
| VISITA | Visita Presencial | 🚶 |
| WHATSAPP | Mensaje WhatsApp | 💬 |
| EMAIL | Correo Electrónico | 📧 |
| SMS | Mensaje de Texto | 📱 |
| CARTA | Carta Formal | 📄 |
| MOTORIZADO | Envío Motorizado | 🏍️ |
| VIDEOLLAMADA | Videollamada | 📹 |
| OTRO | Otro | 📋 |

## 2. Nuevos Resultados de Gestión

Se reemplazaron los resultados básicos con opciones más específicas y profesionales:

### Resultados Positivos
- ✅ **Pago Realizado**: Cliente realizó el pago completo
- 💰 **Pago Parcial**: Cliente realizó pago parcial, pendiente saldo
- 🤝 **Compromiso de Pago**: Cliente se compromete a pagar en fecha específica

### Solicitudes del Cliente
- 🔄 **Solicita Refinanciación**: Cliente solicita refinanciar su deuda
- 💸 **Solicita Descuento**: Cliente solicita descuento en la deuda
- ⏰ **Solicita Más Plazo**: Cliente solicita extensión de plazo

### Problemas y Obstáculos
- ❌ **Se Niega a Pagar**: Cliente se niega explícitamente a pagar
- 💔 **Problemas Económicos**: Cliente reporta dificultades económicas
- ⚠️ **Reclamo sobre Producto**: Cliente tiene reclamo sobre el producto/servicio

### Sin Contacto
- 📵 **No Contesta**: No responde llamadas ni mensajes
- ☎️ **Número Equivocado**: Número telefónico incorrecto o desactualizado

### Situaciones Especiales
- 🕊️ **Cliente Fallecido**: Se informa fallecimiento del cliente
- ✈️ **Cliente de Viaje**: Cliente está de viaje temporalmente
- 📅 **Reprogramado**: Seguimiento reprogramado para otra fecha
- ⚖️ **Derivado a Legal**: Caso derivado al área legal

### Otros
- 📝 **Otro**: Otro resultado no especificado

## 3. Lógica de Fecha de Seguimiento

El sistema ahora es inteligente:
- **Requiere fecha**: Compromiso de pago, solicitudes, problemas, reprogramaciones
- **No requiere fecha**: Pago realizado, se niega a pagar, cliente fallecido, derivado a legal

## 4. Migración de Base de Datos

### Ejecutar en Supabase SQL Editor:

```sql
-- Archivo: supabase/migrations/20240223000000_update_collection_actions.sql
```

Este script:
1. Actualiza los constraints de `action_type` con las nuevas opciones
2. Actualiza los constraints de `result` con las nuevas opciones
3. Mantiene compatibilidad con datos existentes

## 5. Interfaz Mejorada

### Formulario de Acción de Cobranza

El formulario ahora incluye:

1. **Tipo de Acción** (Select con iconos)
   - Lista desplegable con todos los tipos de acción
   - Cada opción muestra un icono descriptivo

2. **Resultado de la Gestión** (Select con descripciones)
   - Lista desplegable con todos los resultados posibles
   - Cada opción muestra:
     - Icono representativo
     - Nombre del resultado (con color)
     - Descripción breve

3. **Descripción** (Textarea)
   - Campo para detalles de la gestión
   - Máximo 500 caracteres

4. **Fecha de Seguimiento** (Date input - condicional)
   - Solo se muestra si el resultado seleccionado lo requiere
   - Fecha mínima: hoy
   - Incluye descripción del propósito

### Tabla de Acciones de Cobranza

La tabla ahora muestra:
- Fecha de la acción
- Tipo de acción (badge)
- Resultado (con color según tipo)
- Notas de la gestión
- Fecha de seguimiento (si aplica)

## 6. Archivos Modificados

### Nuevos Archivos
- `lib/constants/collection-actions.ts` - Constantes y utilidades
- `supabase/migrations/20240223000000_update_collection_actions.sql` - Migración

### Archivos Actualizados
- `components/clients/add-collection-action-form.tsx` - Formulario mejorado
- `components/clients/collection-actions-table.tsx` - Tabla actualizada
- `app/api/collection-actions/route.ts` - API actualizada
- `lib/validations/debt.ts` - Validaciones actualizadas
- `lib/services/collection-service.ts` - Servicio actualizado

## 7. Pasos para Implementar

### Paso 1: Ejecutar Migración
```bash
# En Supabase SQL Editor, ejecutar:
supabase/migrations/20240223000000_update_collection_actions.sql
```

### Paso 2: Verificar Cambios
1. Ir a la página de un cliente con deuda
2. Hacer clic en "Agregar Acción de Cobranza"
3. Verificar que aparecen las nuevas opciones en los selects
4. Probar crear una acción con diferentes resultados
5. Verificar que la fecha de seguimiento solo aparece cuando es necesaria

### Paso 3: Migrar Datos Existentes (Opcional)

Si tienes datos existentes con los valores antiguos, puedes mapearlos:

```sql
-- Mapeo de resultados antiguos a nuevos
UPDATE collection_actions 
SET result = CASE 
  WHEN result = 'PROMESA_PAGO' THEN 'COMPROMISO_PAGO'
  WHEN result = 'SIN_INTENCION' THEN 'SE_NIEGA_PAGAR'
  WHEN result = 'NO_RESPONDE' THEN 'NO_CONTESTA'
  WHEN result = 'PAGO' THEN 'PAGO_REALIZADO'
  ELSE result
END
WHERE result IN ('PROMESA_PAGO', 'SIN_INTENCION', 'NO_RESPONDE', 'PAGO');
```

## 8. Beneficios

### Para el Negocio
- ✅ Mejor seguimiento de gestiones de cobranza
- ✅ Identificación clara de patrones de comportamiento
- ✅ Métricas más precisas de efectividad
- ✅ Mejor toma de decisiones

### Para el Usuario
- ✅ Interfaz más intuitiva con iconos
- ✅ Opciones más específicas y profesionales
- ✅ Menos campos obligatorios cuando no son necesarios
- ✅ Descripciones claras de cada opción

### Para el Sistema
- ✅ Validaciones más robustas
- ✅ Datos más estructurados
- ✅ Mejor integridad de datos
- ✅ Facilita reportes y análisis

## 9. Ejemplos de Uso

### Caso 1: Cliente Promete Pagar
- Tipo: LLAMADA
- Resultado: COMPROMISO_PAGO
- Descripción: "Cliente se compromete a pagar el lunes 25"
- Fecha Seguimiento: 25/02/2026

### Caso 2: Cliente No Contesta
- Tipo: WHATSAPP
- Resultado: NO_CONTESTA
- Descripción: "Enviado mensaje, no responde. Intentar nuevamente mañana"
- Fecha Seguimiento: 23/02/2026

### Caso 3: Cliente Solicita Descuento
- Tipo: VISITA
- Resultado: SOLICITA_DESCUENTO
- Descripción: "Cliente solicita 20% de descuento por dificultades económicas"
- Fecha Seguimiento: 28/02/2026 (para respuesta)

### Caso 4: Pago Realizado
- Tipo: LLAMADA
- Resultado: PAGO_REALIZADO
- Descripción: "Cliente realizó transferencia por S/ 500.00"
- Fecha Seguimiento: (no requerida)

## 10. Reportes Sugeridos

Con estos nuevos datos, puedes crear reportes como:

- **Efectividad por Tipo de Acción**: ¿Qué canal funciona mejor?
- **Tasa de Compromiso vs Pago**: ¿Cuántos compromisos se cumplen?
- **Motivos de No Pago**: Distribución de resultados negativos
- **Tiempo de Respuesta**: Días entre acción y resultado
- **Gestiones por Cobrador**: Productividad del equipo

## Notas Importantes

- ⚠️ La migración es compatible con datos existentes
- ⚠️ Los valores antiguos seguirán funcionando hasta que los actualices
- ⚠️ Se recomienda capacitar al equipo en las nuevas opciones
- ⚠️ Considera crear un manual de uso interno con ejemplos
