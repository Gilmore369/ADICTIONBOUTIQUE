# Correcciones: Crédito Usado y Mapa de Deudores

## Resumen de Problemas Identificados

### 1. Error de Importación en `credit-summary-card.tsx`
- **Problema**: Importaba `getAvailableCredit` que no existía en `lib/utils/currency.ts`
- **Solución**: Agregada función `getCreditColor()` que faltaba

### 2. Cálculo Incorrecto de `credit_used`
- **Problema**: `credit_used` representaba el total histórico de crédito usado, no la deuda pendiente actual
- **Impacto**: 
  - Clientes mostraban crédito negativo
  - No se decrementaba correctamente al pagar
  - No reflejaba la realidad de lo que el cliente debe
- **Solución**: Implementado sistema de recálculo automático basado en cuotas pendientes

### 3. Clientes Sin Coordenadas en el Mapa
- **Problema**: Clientes de Trujillo no aparecían en el mapa porque no tenían lat/lng registrados
- **Solución**: Script SQL para asignar coordenadas predeterminadas de Trujillo

---

## Archivos Modificados

### 1. `lib/utils/currency.ts`
**Cambio**: Agregada función `getCreditColor()`

```typescript
export function getCreditColor(creditLimit: number, creditUsed: number): string {
  const utilization = calculateCreditUtilization(creditLimit, creditUsed)
  
  if (utilization >= 90) return 'text-red-600'
  if (utilization >= 75) return 'text-orange-600'
  if (utilization >= 50) return 'text-yellow-600'
  return 'text-green-600'
}
```

### 2. `actions/payments.ts`
**Cambio**: Usar `recalculate_client_credit_used` en lugar de `decrement_credit_used`

**Antes**:
```typescript
await supabase.rpc('decrement_credit_used', {
  p_client_id: client_id,
  p_amount: totalApplied
})
```

**Después**:
```typescript
await supabase.rpc('recalculate_client_credit_used', {
  p_client_id: client_id
})
```

**Beneficio**: Siempre calcula la deuda real basándose en cuotas pendientes, no en decrementos manuales.

---

## Scripts SQL Creados

### 1. `supabase/FIX_CREDIT_USED.sql`
**Propósito**: Recalcular `credit_used` para todos los clientes existentes

**Qué hace**:
1. Crea función `recalculate_client_credit_used(p_client_id)`
2. Recalcula `credit_used` para TODOS los clientes
3. Muestra estadísticas de verificación

**Cómo ejecutar**:
```bash
# En Supabase SQL Editor
psql -h <host> -U postgres -d postgres -f supabase/FIX_CREDIT_USED.sql
```

**Resultado esperado**:
```
Iniciando recálculo de credit_used para 50 clientes...
Procesados 10 de 50 clientes...
Procesados 20 de 50 clientes...
...
Recálculo completado: 50 clientes actualizados
```

### 2. `supabase/migrations/20240224000000_fix_credit_used_logic.sql`
**Propósito**: Implementar recálculo automático de `credit_used`

**Qué hace**:
1. Crea función `recalculate_client_credit_used()`
2. Crea trigger `trigger_recalculate_credit_used()`
3. Trigger se ejecuta automáticamente cuando se modifica una cuota

**Beneficio**: `credit_used` siempre estará sincronizado con las cuotas pendientes.

**Cómo ejecutar**:
```bash
# Aplicar migración en Supabase
supabase db push
```

### 3. `supabase/migrations/20240224000001_update_sale_transaction.sql`
**Propósito**: Actualizar función `create_sale_transaction` para usar recálculo

**Qué hace**:
- Reemplaza `increment_credit_used` por `recalculate_client_credit_used`
- Asegura que ventas a crédito actualicen correctamente la deuda

### 4. `supabase/FIX_CLIENT_COORDINATES.sql`
**Propósito**: Asignar coordenadas a clientes sin ubicación

**Qué hace**:
1. Verifica cuántos clientes no tienen coordenadas
2. Asigna coordenadas aleatorias dentro del área de Trujillo
3. Rango: ±3.3 km del centro de Trujillo

**Centro de Trujillo**:
- Latitud: -8.1116
- Longitud: -79.0288

**Cómo ejecutar**:
```bash
# En Supabase SQL Editor
psql -h <host> -U postgres -d postgres -f supabase/FIX_CLIENT_COORDINATES.sql
```

**Resultado esperado**:
```
total_clientes | sin_coordenadas | con_coordenadas
---------------|-----------------|----------------
50             | 0               | 50
```

---

## Cómo Funciona el Nuevo Sistema de `credit_used`

### Concepto
`credit_used` = Suma de (amount - paid_amount) de cuotas con status IN ('PENDING', 'PARTIAL', 'OVERDUE')

### Ejemplo

**Cliente: Juan Pérez**
- Límite de crédito: S/ 5,000.00
- Compra a crédito: S/ 3,000.00 en 3 cuotas de S/ 1,000.00

**Estado inicial**:
```
Cuota 1: S/ 1,000.00 - PENDING
Cuota 2: S/ 1,000.00 - PENDING
Cuota 3: S/ 1,000.00 - PENDING
credit_used = S/ 3,000.00
```

**Después de pagar S/ 1,500.00**:
```
Cuota 1: S/ 1,000.00 - PAID (paid_amount = 1,000)
Cuota 2: S/ 500.00 pendiente - PARTIAL (paid_amount = 500)
Cuota 3: S/ 1,000.00 - PENDING
credit_used = S/ 1,500.00  ← Recalculado automáticamente
```

**Crédito disponible**:
```
S/ 5,000.00 - S/ 1,500.00 = S/ 3,500.00
```

### Ventajas
1. ✅ Refleja la deuda real del cliente
2. ✅ Se actualiza automáticamente con pagos
3. ✅ Nunca muestra crédito negativo
4. ✅ Sincronizado con cuotas pendientes

---

## Verificación Post-Implementación

### 1. Verificar Función de Recálculo
```sql
-- Probar con un cliente específico
SELECT recalculate_client_credit_used('client-uuid-here');

-- Ver resultado
SELECT 
  id, 
  name, 
  credit_limit, 
  credit_used,
  credit_limit - credit_used AS credito_disponible
FROM clients
WHERE id = 'client-uuid-here';
```

### 2. Verificar Trigger
```sql
-- Actualizar una cuota manualmente
UPDATE installments
SET paid_amount = 500, status = 'PARTIAL'
WHERE id = 'installment-uuid-here';

-- Verificar que credit_used se actualizó automáticamente
SELECT 
  c.name,
  c.credit_used,
  SUM(i.amount - i.paid_amount) AS deuda_calculada
FROM clients c
JOIN credit_plans cp ON cp.client_id = c.id
JOIN installments i ON i.plan_id = cp.id
WHERE i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
  AND c.id = (
    SELECT cp.client_id 
    FROM installments i2
    JOIN credit_plans cp ON cp.id = i2.plan_id
    WHERE i2.id = 'installment-uuid-here'
  )
GROUP BY c.id, c.name, c.credit_used;
```

### 3. Verificar Coordenadas en Mapa
```sql
-- Contar clientes con coordenadas
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS con_coordenadas,
  COUNT(*) FILTER (WHERE credit_used > 0) AS con_deuda,
  COUNT(*) FILTER (WHERE credit_used > 0 AND lat IS NOT NULL) AS deudores_en_mapa
FROM clients;
```

### 4. Probar en la UI
1. Ir a `/clients` - verificar que no hay créditos negativos
2. Ir a `/map` - verificar que aparecen clientes en el mapa
3. Registrar un pago - verificar que `credit_used` disminuye
4. Crear venta a crédito - verificar que `credit_used` aumenta

---

## Orden de Ejecución Recomendado

```bash
# 1. Aplicar migraciones (crea funciones y triggers)
supabase db push

# 2. Recalcular credit_used para datos existentes
psql -h <host> -U postgres -d postgres -f supabase/FIX_CREDIT_USED.sql

# 3. Asignar coordenadas a clientes
psql -h <host> -U postgres -d postgres -f supabase/FIX_CLIENT_COORDINATES.sql

# 4. Verificar resultados
# Ejecutar queries de verificación arriba
```

---

## Notas Importantes

### Sobre `credit_used`
- ⚠️ **NO modificar manualmente** `credit_used` en la tabla `clients`
- ✅ Usar siempre `recalculate_client_credit_used()` si necesitas recalcular
- ✅ El trigger se encarga de mantenerlo sincronizado automáticamente

### Sobre Coordenadas
- 📍 Las coordenadas asignadas son aproximadas (área de Trujillo)
- 📍 Para mayor precisión, usar:
  1. API de Google Geocoding
  2. Captura GPS durante visitas
  3. Actualización manual desde el formulario de cliente

### Sobre el Mapa
- 🗺️ Solo muestra clientes con `lat` y `lng` no nulos
- 🗺️ Filtros disponibles: Atrasados, Próximos a Vencer, Al Día, Todos
- 🗺️ Colores indican nivel de deuda/riesgo

---

## Soporte

Si encuentras problemas:
1. Verificar que las migraciones se aplicaron correctamente
2. Revisar logs de Supabase para errores de trigger
3. Ejecutar queries de verificación
4. Contactar al equipo de desarrollo
